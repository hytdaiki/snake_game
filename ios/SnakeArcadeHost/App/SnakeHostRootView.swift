import SwiftUI

struct SnakeHostRootView: View {
    var body: some View {
        SnakeWebViewContainer()
            .ignoresSafeArea(edges: .bottom)
    }
}
