import AppKit
import Foundation

let fileManager = FileManager.default
let directory = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : fileManager.currentDirectoryPath)
let font = NSFont.systemFont(ofSize: 30, weight: .heavy)
let titleFont = NSFont.systemFont(ofSize: 25, weight: .bold)
let foreground = NSColor(calibratedWhite: 0.98, alpha: 1)
let background = NSColor(calibratedRed: 0.025, green: 0.022, blue: 0.04, alpha: 1)

func loadImages() throws -> [NSImage] {
    try (1...10).map { index in
        let name = String(format: "MEDIA-my-sgg-home-hero-%02d-v001.png", index)
        let url = directory.appendingPathComponent(name)
        guard let image = NSImage(contentsOf: url) else {
            throw NSError(domain: "ContactSheet", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not load \(url.path)"])
        }
        return image
    }
}

func drawLabel(_ label: String, at point: NSPoint) {
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: foreground
    ]
    let size = label.size(withAttributes: attributes)
    let box = NSRect(x: point.x, y: point.y, width: size.width + 24, height: size.height + 12)
    NSColor(calibratedWhite: 0, alpha: 0.78).setFill()
    NSBezierPath(roundedRect: box, xRadius: 7, yRadius: 7).fill()
    label.draw(at: NSPoint(x: point.x + 12, y: point.y + 5), withAttributes: attributes)
}

func writeSheet(
    images: [NSImage],
    outputName: String,
    title: String,
    columns: Int,
    tileSize: NSSize,
    sourceRect: (NSImage) -> NSRect
) throws {
    let margin: CGFloat = 24
    let titleHeight: CGFloat = 68
    let gap: CGFloat = 12
    let rows = Int(ceil(Double(images.count) / Double(columns)))
    let width = margin * 2 + CGFloat(columns) * tileSize.width + CGFloat(columns - 1) * gap
    let height = margin * 2 + titleHeight + CGFloat(rows) * tileSize.height + CGFloat(rows - 1) * gap

    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: Int(width),
        pixelsHigh: Int(height),
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        throw NSError(domain: "ContactSheet", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not create bitmap context"])
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    background.setFill()
    NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()

    title.draw(
        at: NSPoint(x: margin, y: height - margin - 38),
        withAttributes: [
            .font: titleFont,
            .foregroundColor: NSColor(calibratedRed: 0.9, green: 0.77, blue: 0.44, alpha: 1)
        ]
    )

    for (offset, image) in images.enumerated() {
        let column = offset % columns
        let row = offset / columns
        let x = margin + CGFloat(column) * (tileSize.width + gap)
        let top = margin + titleHeight + CGFloat(row) * (tileSize.height + gap)
        let y = height - top - tileSize.height
        let destination = NSRect(origin: NSPoint(x: x, y: y), size: tileSize)
        image.draw(
            in: destination,
            from: sourceRect(image),
            operation: .copy,
            fraction: 1,
            respectFlipped: false,
            hints: [.interpolation: NSImageInterpolation.high]
        )
        drawLabel(String(format: "%02d", offset + 1), at: NSPoint(x: x + 12, y: y + tileSize.height - 56))
    }

    NSGraphicsContext.restoreGraphicsState()
    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "ContactSheet", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not encode PNG"])
    }
    try data.write(to: directory.appendingPathComponent(outputName), options: .atomic)
}

let images = try loadImages()

try writeSheet(
    images: images,
    outputName: "CONTACT_SHEET.png",
    title: "MY SGG HOME HERO — IMAGE 2.0 — DESKTOP OVERVIEW",
    columns: 2,
    tileSize: NSSize(width: 600, height: 338),
    sourceRect: { image in NSRect(origin: .zero, size: image.size) }
)

try writeSheet(
    images: images,
    outputName: "MOBILE_CROP_CONTACT_SHEET.png",
    title: "MOBILE OBJECT-FIT QA — APPROX. 390 × 630 / OBJECT-POSITION 60%",
    columns: 5,
    tileSize: NSSize(width: 240, height: 417),
    sourceRect: { image in
        let cropWidth = image.size.height * (390.0 / 630.0)
        let overflow = image.size.width - cropWidth
        return NSRect(x: overflow * 0.60, y: 0, width: cropWidth, height: image.size.height)
    }
)
