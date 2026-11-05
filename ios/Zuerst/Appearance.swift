import SwiftUI
import UIKit

enum Palette {
    static func adaptive(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { traits in
            let value = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
        })
    }
    static let canvas = adaptive(0xFAF8F3, 0x17151B)
    static let card = adaptive(0xFFFEFA, 0x242129)
    static let action = adaptive(0x633A82, 0xD9B7FF)
    static let onAction = adaptive(0xFFFFFF, 0x35174C)
    static let movement = adaptive(0xB7E5CF, 0x124F42)
    static let onMovement = adaptive(0x143F33, 0xBAF3DC)
    static let nutrition = adaptive(0xFFDBBF, 0x633A28)
    static let onNutrition = adaptive(0x4F2E1C, 0xFFE2C7)
    static let kitchen = adaptive(0xD0EBA3, 0x354A1C)
    static let onKitchen = adaptive(0x24370D, 0xDDF5B7)
    static let water = adaptive(0xC8E5FF, 0x174F72)
    static let onWater = adaptive(0x163C5B, 0xD8F0FF)
    static let trend = adaptive(0xDDD0FF, 0x4D3071)
    static let onTrend = adaptive(0x3D225D, 0xEDDDFF)
    static func foreground(_ tint: Color) -> Color {
        if tint == kitchen { return onKitchen }; if tint == water { return onWater }
        if tint == movement { return onMovement }; if tint == nutrition { return onNutrition }
        if tint == trend { return onTrend }; return .primary
    }
}

struct PillLayout: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { arrange(subviews, width: proposal.width ?? 320).size }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let layout = arrange(subviews, width: bounds.width)
        for (index, view) in subviews.enumerated() { view.place(at: CGPoint(x: bounds.minX + layout.points[index].x, y: bounds.minY + layout.points[index].y), proposal: ProposedViewSize(width: min(view.sizeThatFits(.unspecified).width,bounds.width), height: view.sizeThatFits(.unspecified).height)) }
    }
    private func arrange(_ subviews: Subviews, width: CGFloat) -> (size: CGSize, points: [CGPoint]) {
        var x: CGFloat = 0; var y: CGFloat = 0; var height: CGFloat = 0; var points: [CGPoint] = []
        for view in subviews { let size = view.sizeThatFits(ProposedViewSize(width: width, height: nil)); if x > 0 && x + size.width > width { x = 0; y += height + 10; height = 0 }; points.append(CGPoint(x: x, y: y)); x += min(size.width,width) + 8; height = max(height,size.height) }
        return (CGSize(width: width, height: y + height),points)
    }
}

struct AppearancePicker: View {
    @AppStorage("appearance_mode") private var mode = "system"
    private let modes = [("system", "System", "circle.lefthalf.filled"), ("light", "Hell", "sun.max"), ("dark", "Dunkel", "moon")]
    var body: some View {
        JournalPanel(tint: Palette.trend) {
            Text("Darstellung").font(.headline)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { choices }
                VStack(alignment: .leading, spacing: 10) { choices }
            }
        }
    }
    @ViewBuilder private var choices: some View {
        ForEach(modes, id: \.0) { item in
            Button { mode = item.0 } label: {
                HStack(spacing: 7) { Image(systemName: item.2); Text(item.1); Image(systemName: "checkmark").opacity(mode == item.0 ? 1 : 0) }
                    .padding(.horizontal, 14).padding(.vertical, 12).frame(minHeight: 48)
                    .background(mode == item.0 ? Palette.action : Palette.card, in: Capsule())
                    .foregroundStyle(mode == item.0 ? Palette.onAction : Color.primary)
            }
            .buttonStyle(.plain).accessibilityAddTraits(mode == item.0 ? .isSelected : [])
        }
    }
}
