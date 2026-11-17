// Regenerate production illustrations from the editable text SVGs:
// swift output/discovery-reference/outline-archivo.swift
// Uses the original Archivo variable font and macOS CoreText; no dependencies.
import Foundation
import CoreText
import CoreGraphics

let base = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let fontURL = base.appendingPathComponent("output/design-reference/fonts/Archivo.ttf")
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
func number(_ value: CGFloat) -> String {
    var s = String(format: "%.2f", Double(value))
    while s.last == "0" { s.removeLast() }
    if s.last == "." { s.removeLast() }
    return s == "-0" ? "0" : s
}
func pathData(_ path: CGPath) -> String {
    var data = ""
    func point(_ p: CGPoint) -> String { number(p.x) + " " + number(p.y) }
    path.applyWithBlock { pointer in
        let e = pointer.pointee
        switch e.type {
        case .moveToPoint: data += "M" + point(e.points[0])
        case .addLineToPoint: data += "L" + point(e.points[0])
        case .addQuadCurveToPoint: data += "Q" + point(e.points[0]) + " " + point(e.points[1])
        case .addCurveToPoint: data += "C" + point(e.points[0]) + " " + point(e.points[1]) + " " + point(e.points[2])
        case .closeSubpath: data += "Z"
        @unknown default: fatalError("Unexpected path element")
        }
    }
    return data
}
func add(_ name: String, _ value: String, to element: XMLElement) {
    element.addAttribute(XMLNode.attribute(withName: name, stringValue: value) as! XMLNode)
}
for name in ["seo", "aeo", "geo"] {
    let source = base.appendingPathComponent("output/discovery-reference/source/discovery-\(name).svg")
    let document = try XMLDocument(contentsOf: source, options: [.nodePreserveAll])
    for node in try document.nodes(forXPath: "//*[local-name()='text']") {
        guard let text = node as? XMLElement, let parent = text.parent as? XMLElement else { continue }
        func attribute(_ key: String, _ fallback: String) -> String { text.attribute(forName: key)?.stringValue ?? fallback }
        let content = text.stringValue ?? ""
        let size = Double(attribute("font-size", "26"))!
        let weight = Double(attribute("font-weight", "400"))!
        let descriptor = CTFontDescriptorCreateWithAttributes([
            kCTFontURLAttribute: fontURL,
            kCTFontVariationAttribute: [NSNumber(value: 0x77676874): NSNumber(value: weight)]
        ] as CFDictionary)
        let font = CTFontCreateWithFontDescriptor(descriptor, size, nil)
        precondition((CTFontCopyFamilyName(font) as String).contains("Archivo"), "Archivo font unavailable")
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: content, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font]))
        let width = CTLineGetTypographicBounds(line, nil, nil, nil)
        if let max = Double(attribute("data-max-width", "")) { precondition(width <= max, "Text too wide: \(content) (\(width) > \(max))") }
        let combined = CGMutablePath()
        for run in CTLineGetGlyphRuns(line) as! [CTRun] {
            let count = CTRunGetGlyphCount(run)
            var glyphs = [CGGlyph](repeating: 0, count: count)
            var positions = [CGPoint](repeating: .zero, count: count)
            CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
            CTRunGetPositions(run, CFRange(location: 0, length: 0), &positions)
            let attrs = CTRunGetAttributes(run) as NSDictionary
            let runFont = attrs[kCTFontAttributeName] as! CTFont
            for index in 0..<count {
                if let path = CTFontCreatePathForGlyph(runFont, glyphs[index], nil) {
                    combined.addPath(path, transform: CGAffineTransform(translationX: positions[index].x, y: positions[index].y))
                }
            }
        }
        let group = XMLElement(name: "g")
        add("aria-label", content, to: group)
        add("transform", "translate(\(attribute("x", "0")) \(attribute("y", "0"))) scale(1 -1)", to: group)
        add("fill", attribute("fill", "#171a24"), to: group)
        let path = XMLElement(name: "path")
        add("d", pathData(combined), to: path)
        group.addChild(path)
        parent.replaceChild(at: text.index, with: group)
    }
    let output = base.appendingPathComponent("src/panel/assets/discovery-\(name).svg")
    try document.xmlData(options: [.nodePrettyPrint]).write(to: output)
    print("Outlined \(output.lastPathComponent)")
}
