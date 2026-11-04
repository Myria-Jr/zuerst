import Foundation

@main
struct CatalogCheck {
    static func main() throws {
        let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let catalog = try JSONDecoder().decode(Catalog.self, from: data)
        let picks = ["paprika", "eggs"]
        precondition(catalog.recipes.count == 24 && catalog.recipes.allSatisfy { (1...20).contains($0.minutes) })
        precondition(catalog.choices(picked: picks) == ["oil", "salt", "rice", "cannedtomatoes"])
        precondition(catalog.matches(picked: picks, confirmed: ["salt"]).almost?.missing == ["oil"])
        precondition(catalog.matches(picked: picks, confirmed: ["oil", "salt"]).complete.map(\.recipe.id) == ["paprika-eier"])
        let ranked = catalog.matches(picked: picks + ["rice"], confirmed: ["oil", "salt", "cannedtomatoes"])
        precondition(ranked.complete.map(\.recipe.id) == ["paprika-reis", "paprika-eier", "shakshuka"])
        let empty = catalog.matches(picked: ["cucumber", "paprika", "eggs"], confirmed: ["oil", "salt"])
        precondition(empty.complete.isEmpty && empty.almost == nil)
        precondition(catalog.search("MOHREN").first == "carrots")
        let receipt = "BIO EIER 10 ST 2,49\nPAPRIKA ROT 1,19\nPAPRIKA CHIPS 1,99\nRABATT BROT 0,30\nBASMATI REIS 1,79\nEIER 2,49\nSUMME 9,55"
        precondition(catalog.receipt(receipt) == ["eggs", "paprika"])
        precondition(catalog.ready(stock: ["eggs", "paprika", "oil", "salt"]).first?.id == "paprika-eier")
        precondition(catalog.ready(stock: ["eggs", "paprika"]).isEmpty)
        print("Zuerst: nativer Swift-Katalog geprüft")
    }
}
