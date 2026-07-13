import type { Metadata } from "next";
import { Dashboard } from "./Dashboard";

export const metadata: Metadata = {
  title: "マイダッシュボード",
  description:
    "大会戦績、保有アセット、SGGポイント、アカウント連携をひとつにまとめるプレイヤーダッシュボード。",
};

export default function Home() {
  return <Dashboard />;
}
