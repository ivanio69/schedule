import Foundation

enum WidgetAPIError: LocalizedError {
    case notConnected
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "нет токена в App Group"
        case .invalidResponse:
            return "сервер вернул некорректный ответ"
        case .server(let message):
            return message
        }
    }
}

enum WidgetAPI {
    private struct ExchangeBody: Codable {
        let code: String
        let deviceId: String?
    }

    static func exchange(code: String, deviceId: String?) async throws -> WidgetExchangeResponse {
        let url = WidgetEnvironment.productionBaseURL.appending(path: "/api/widget/exchange")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(ExchangeBody(code: code, deviceId: deviceId))

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(WidgetExchangeResponse.self, from: data)
    }

    static func feed(for date: Date) async throws -> WidgetFeed {
        guard let token = WidgetStore.token else { throw WidgetAPIError.notConnected }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"

        var components = URLComponents(
            url: WidgetEnvironment.productionBaseURL.appending(path: "/api/widget/feed"),
            resolvingAgainstBaseURL: false
        )!
        components.queryItems = [URLQueryItem(name: "date", value: formatter.string(from: date))]
        guard let url = components.url else { throw WidgetAPIError.invalidResponse }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 12

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response: response, data: data)
        let feed = try JSONDecoder().decode(WidgetFeed.self, from: data)
        WidgetStore.cache(feed: feed)
        return feed
    }

    static func disconnect() async {
        guard let token = WidgetStore.token else {
            WidgetStore.clear()
            return
        }
        var request = URLRequest(url: WidgetEnvironment.productionBaseURL.appending(path: "/api/widget/token"))
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        _ = try? await URLSession.shared.data(for: request)
        WidgetStore.clear()
    }

    private static func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw WidgetAPIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw WidgetAPIError.server(message ?? "HTTP \(http.statusCode)")
        }
    }
}
