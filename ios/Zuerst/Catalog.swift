import Foundation

struct Ingredient: Decodable, Identifiable {
    let id: String
    let name: String
    let aliases: [String]
}

struct RecipeAmount: Decodable, Identifiable {
    let id: String
    let amount: String
}

struct Recipe: Decodable, Identifiable {
    let id: String
    let name: String
    let minutes: Int
    let note: String
    let items: [RecipeAmount]
    let steps: [String]
}

struct Candidate {
    let recipe: Recipe
    let used: [String]
    let missing: [String]
    fileprivate let order: Int
}

struct RecipeMatches {
    let complete: [Candidate]
    let almost: Candidate?
}

struct Catalog: Decodable {
    let ingredients: [Ingredient]
    let quick: [String]
    let pantry: Set<String>
    let recipes: [Recipe]

    static func load(from bundle: Bundle = .main) throws -> Self {
        guard let url = bundle.url(forResource: "catalog", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        return try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
    }

    func name(_ id: String) -> String { ingredients.first(where: { $0.id == id })?.name ?? id }

    func search(_ query: String) -> [String] {
        let terms = Self.normalized(query).split(whereSeparator: \.isWhitespace).map(String.init)
        let value = terms.joined(separator: " ")
        return ingredients.compactMap { ingredient -> (Ingredient, Int)? in
            let names = ([ingredient.name] + ingredient.aliases).map(Self.normalized)
            guard terms.allSatisfy({ term in names.contains(where: { $0.contains(term) }) }) else { return nil }
            let score = names.contains(value) ? 0 : names.contains(where: { $0.hasPrefix(value) }) ? 1 : 2
            return (ingredient, score)
        }.sorted { lhs, rhs in
            if lhs.1 != rhs.1 { return lhs.1 < rhs.1 }
            return lhs.0.name.compare(rhs.0.name, locale: Locale(identifier: "de")) == .orderedAscending
        }.map { $0.0.id }
    }

    func choices(picked: [String]) -> [String] {
        let ranked = candidates(picked: picked, present: Set(picked)).sorted { lhs, rhs in
            if lhs.used.count != rhs.used.count { return lhs.used.count > rhs.used.count }
            if lhs.missing.count != rhs.missing.count { return lhs.missing.count < rhs.missing.count }
            if lhs.recipe.minutes != rhs.recipe.minutes { return lhs.recipe.minutes < rhs.recipe.minutes }
            return lhs.order < rhs.order
        }
        var seen = Set<String>()
        return Array(ranked.flatMap(\.missing).filter { seen.insert($0).inserted }.prefix(4))
    }

    func matches(picked: [String], confirmed: Set<String>) -> RecipeMatches {
        let ranked = candidates(picked: picked, present: confirmed.union(picked)).sorted { lhs, rhs in
            if lhs.used.count != rhs.used.count { return lhs.used.count > rhs.used.count }
            if lhs.recipe.minutes != rhs.recipe.minutes { return lhs.recipe.minutes < rhs.recipe.minutes }
            return lhs.order < rhs.order
        }
        return RecipeMatches(complete: ranked.filter { $0.missing.isEmpty }, almost: ranked.first { $0.missing.count == 1 })
    }

    private func candidates(picked: [String], present: Set<String>) -> [Candidate] {
        guard let first = picked.first else { return [] }
        return recipes.enumerated().compactMap { order, recipe in
            let required = recipe.items.map(\.id)
            guard required.contains(first) else { return nil }
            return Candidate(recipe: recipe, used: picked.filter(required.contains), missing: required.filter { !present.contains($0) }, order: order)
        }
    }

    private static func normalized(_ value: String) -> String {
        value.lowercased(with: Locale(identifier: "de")).replacingOccurrences(of: "ß", with: "ss")
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "de"))
    }
}
