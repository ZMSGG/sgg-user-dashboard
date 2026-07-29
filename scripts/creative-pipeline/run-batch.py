#!/usr/bin/env python3
"""Image 2.0 batch driver for dashboard creatives.

Reads a batch spec (JSON list of slots), generates each image through the
Codex built-in image generation, and appends PENDING_APPROVAL rows to the
asset manifest. Reference images define character identity only; pasting
source art into output is prohibited by owner rule (2026-07-29) and every
prompt in a spec must carry the no-copy clause.

Usage: python3 scripts/creative-pipeline/run-batch.py spec.json --workers 2
"""
import json, subprocess, sys, os, hashlib, argparse, tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

def expand_ref(ref):
    """command-center:// refs resolve through COMMAND_CENTER_LINK.json so specs
    stay free of personal absolute paths."""
    if ref.startswith("command-center://"):
        import json as _json
        here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        link = _json.load(open(os.path.join(here, "COMMAND_CENTER_LINK.json")))
        return os.path.join(here, link["relative_path"], ref[len("command-center://"):])
    return ref

NO_COPY = "参照画像の背景・ポーズ・構図・白背景・キラキラ地をそのまま使うことは禁止。素材の切り抜き貼り付けをしない。文字・ロゴ・数字・UI・枠・透かし・署名を入れない。"

def run_slot(slot, outdir):
    out = os.path.join(outdir, slot["file"])
    if os.path.exists(out):
        return slot["id"], "SKIP_EXISTS"
    prompt = (f"画像生成機能（GPT Image）を使って画像を1枚生成し、このディレクトリに {slot['file']} "
              f"という名前で保存してください。\n\n{slot['prompt']}\n\n【共通禁止事項】{NO_COPY}")
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write(prompt); pfile = f.name
    cmd = ["codex", "exec", "--skip-git-repo-check", "--sandbox", "workspace-write"]
    if slot.get("refs"):
        cmd += ["-i"] + [expand_ref(r) for r in slot["refs"]]
    try:
        with open(pfile) as fin:
            r = subprocess.run(cmd, stdin=fin, cwd=outdir, capture_output=True, text=True, timeout=900)
        ok = os.path.exists(out)
        return slot["id"], "OK" if ok else f"MISSING (rc={r.returncode})"
    finally:
        os.unlink(pfile)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec"); ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--outdir", required=True)
    args = ap.parse_args()
    slots = json.load(open(args.spec))
    os.makedirs(args.outdir, exist_ok=True)
    results = {}
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(run_slot, s, args.outdir): s["id"] for s in slots}
        for fut in as_completed(futs):
            sid, status = fut.result()
            results[sid] = status
            print(f"[{sid}] {status}", flush=True)
    print(json.dumps(results, ensure_ascii=False))

if __name__ == "__main__":
    main()
