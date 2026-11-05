package labs.odkaz.zuerst

import java.net.URI
import java.time.Instant
import java.time.LocalDate

internal enum class Preparation { Unspecified, Raw, Cooked }
internal enum class AmountUnit { Gram, Millilitre, Piece }
internal enum class Evidence { Manual, ReceiptOcr, SocialCaption, PhotoEstimate, HealthConnect, Legacy }
internal enum class DateKind { BestBefore, UseBy, Reminder }
internal enum class RecipeMode { Balanced, Comfort }
internal data class FoodKey(val id: String, val preparation: Preparation = Preparation.Unspecified) {
    init { require(id.isNotBlank()) }
}
internal data class Quantity(val value: Double, val unit: AmountUnit) {
    init { require(value.isFinite() && value > 0) { "Die Menge muss positiv und endlich sein." } }
}
internal data class Provenance(val evidence: Evidence, val reference: String? = null, val observedAt: Instant? = null)

internal data class Nutrients(
    val energyKcal: Double? = null, val proteinG: Double? = null, val carbohydrateG: Double? = null,
    val fatG: Double? = null, val fibreG: Double? = null,
) {
    init { require(listOfNotNull(energyKcal, proteinG, carbohydrateG, fatG, fibreG).all { it.isFinite() && it >= 0 }) }
    fun forGrams(amount: Quantity): Nutrients? = if (amount.unit != AmountUnit.Gram) null else {
        val factor = amount.value / 100.0
        Nutrients(energyKcal?.times(factor), proteinG?.times(factor), carbohydrateG?.times(factor), fatG?.times(factor), fibreG?.times(factor))
    }
    companion object {
        fun total(values: List<Nutrients>): Nutrients {
            fun sum(get: (Nutrients) -> Double?): Double? = if (values.isEmpty() || values.any { get(it) == null }) null else values.sumOf { get(it)!! }
            return Nutrients(sum { it.energyKcal }, sum { it.proteinG }, sum { it.carbohydrateG }, sum { it.fatG }, sum { it.fibreG })
        }
    }
}

internal data class FoodProduct(val key: FoodKey, val name: String, val nutrientsPer100g: Nutrients?, val source: Provenance)
internal data class Expiry(val day: LocalDate, val kind: DateKind)
internal data class InventoryLot(
    val id: String, val food: FoodKey, val amount: Quantity?, val confirmed: Boolean,
    val expiry: Expiry?, val source: Provenance,
)
internal data class IngredientNeed(val food: FoodKey, val amount: Quantity?)
internal enum class Availability { Available, Missing, QuantityUnknown, Insufficient }
internal data class PantryResult(val need: IngredientNeed, val availability: Availability, val excludedUseByLots: Int)

internal fun matchPantry(needs: List<IngredientNeed>, inventory: List<InventoryLot>, today: LocalDate): List<PantryResult> {
    require(needs.map { it.food }.distinct().size == needs.size) { "Doppelte Rezeptzutaten müssen zuerst zusammengeführt werden." }
    return needs.map { need ->
        val candidates = inventory.filter { it.food == need.food && it.confirmed }
        val expired = candidates.filter { it.expiry?.let { date -> date.kind == DateKind.UseBy && date.day < today } == true }
        val usable = candidates - expired.toSet()
        val quantity = need.amount
        val status = when {
            usable.isEmpty() -> Availability.Missing
            quantity == null -> Availability.Available
            else -> {
                val known = usable.mapNotNull { it.amount?.takeIf { q -> q.unit == quantity.unit } }.sumOf { it.value }
                when {
                    known >= quantity.value -> Availability.Available
                    usable.any { it.amount == null || it.amount.unit != quantity.unit } -> Availability.QuantityUnknown
                    else -> Availability.Insufficient
                }
            }
        }
        PantryResult(need, status, expired.size)
    }
}

internal data class NutritionEntry(val id: String, val day: LocalDate, val food: FoodProduct, val amount: Quantity) {
    val nutrients: Nutrients? get() = food.nutrientsPer100g?.forGrams(amount)
}
internal data class HealthDailyTotals(val day: LocalDate, val steps: Long?, val activeEnergyKcal: Double?, val source: Provenance) {
    init {
        require(steps == null || steps >= 0)
        require(activeEnergyKcal == null || activeEnergyKcal.isFinite() && activeEnergyKcal >= 0)
        require(source.evidence == Evidence.HealthConnect)
    }
}

internal data class RecipeDraft(
    val id: String, val title: String, val sourceUrl: String?, val mode: RecipeMode,
    val ingredients: List<IngredientNeed>, val steps: List<String>, val reviewed: Boolean = false,
) {
    init {
        require(title.isNotBlank() && ingredients.isNotEmpty() && steps.isNotEmpty() && steps.all { it.isNotBlank() })
        require(sourceUrl == null || isSupportedRecipeLink(sourceUrl))
    }
    fun confirmed(): RecipeDraft {
        require(ingredients.map { it.food }.distinct().size == ingredients.size)
        return copy(reviewed = true)
    }
}

internal fun isSupportedRecipeLink(value: String): Boolean = runCatching {
    val url = URI(value)
    url.scheme.equals("https", true) && url.userInfo == null && (url.port == -1 || url.port == 443) && url.host?.lowercase() in setOf(
        "instagram.com", "www.instagram.com", "instagr.am", "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
    )
}.getOrDefault(false)

internal fun Journal.inventorySnapshot(): List<InventoryLot> = stock.map { id ->
    InventoryLot("legacy:$id", FoodKey(id, if (id == "rice") Preparation.Cooked else Preparation.Unspecified),
        amount = null, confirmed = true, expiry = expiry[id]?.let { Expiry(it, DateKind.Reminder) }, source = Provenance(Evidence.Legacy))
}
