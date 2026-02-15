import Foundation

enum SnakeHostConfig {
    static let removeAdsProductID = "snake.remove_ads"
    static let webRootDirectoryName = "WebRoot"

    // Fallback for misconfigured bundles during development.
    static let remoteFallbackURL = URL(string: "https://hytdaiki.github.io/snake_game/")
}
