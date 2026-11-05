package labs.odkaz.zuerst

import java.io.File
import java.time.LocalDate
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class DomainTest {
    private val fixture = JSONObject(File(checkNotNull(System.getProperty("zuerst.domainFixtures"))).readText())
    private val raw = FoodKey("pasta", Preparation.Raw)
    private val today = LocalDate.of(2026, 11, 5)
    private fun lot(amount: Quantity? = Quantity(100.0, AmountUnit.Gram)) = InventoryLot("fixture", raw, amount, true, null, Provenance(Evidence.Manual))

    @Test fun nutritionPreservesUnknownsAndRequiresGrams() {
        val input = fixture.getJSONObject("nutrition")
        fun nutrients(data: JSONObject) = Nutrients(data.getDouble("energyKcal"), data.getDouble("proteinG"), data.getDouble("carbohydrateG"), data.getDouble("fatG"), null)
        val source = nutrients(input.getJSONObject("per100g"))
        assertEquals(nutrients(input.getJSONObject("expected")), source.forGrams(Quantity(input.getDouble("grams"), AmountUnit.Gram)))
        assertNull(source.forGrams(Quantity(1.0, AmountUnit.Piece)))
        assertEquals(Nutrients(), Nutrients.total(emptyList()))
        assertNull(Nutrients.total(listOf(source, Nutrients())).energyKcal)
    }
    @Test fun inventoryMatchingHonorsConfirmationPreparationAndQuantities() {
        val needs = listOf(IngredientNeed(raw, Quantity(100.0, AmountUnit.Gram)))
        assertEquals(Availability.Available, matchPantry(needs, listOf(lot(Quantity(75.0, AmountUnit.Gram)), lot(Quantity(25.0, AmountUnit.Gram)).copy(id = "second")), today).single().availability)
        assertEquals(Availability.Insufficient, matchPantry(needs, listOf(lot(Quantity(75.0, AmountUnit.Gram))), today).single().availability)
        assertEquals(Availability.QuantityUnknown, matchPantry(needs, listOf(lot(null)), today).single().availability)
        assertEquals(Availability.Missing, matchPantry(needs, listOf(lot().copy(confirmed = false)), today).single().availability)
        assertEquals(Availability.Missing, matchPantry(needs, listOf(lot().copy(food = raw.copy(preparation = Preparation.Cooked))), today).single().availability)
    }
    @Test fun useByAndReminderDatesRemainDistinct() {
        val needs = listOf(IngredientNeed(raw, null))
        assertEquals(1, matchPantry(needs, listOf(lot().copy(expiry = Expiry(today.minusDays(1), DateKind.UseBy))), today).single().excludedUseByLots)
        assertEquals(Availability.Available, matchPantry(needs, listOf(lot().copy(expiry = Expiry(today.minusDays(1), DateKind.Reminder))), today).single().availability)
        val legacy = Journal(stock = listOf("rice"), expiry = mapOf("rice" to today)).inventorySnapshot().single()
        assertEquals(Preparation.Cooked, legacy.food.preparation); assertNull(legacy.amount); assertEquals(Evidence.Legacy, legacy.source.evidence)
    }
    @Test fun linksMatchTheSharedContract() {
        val links = fixture.getJSONArray("links")
        for(index in 0 until links.length()) { val link = links.getJSONObject(index); assertEquals(link.getString("url"), link.getBoolean("accepted"), isSupportedRecipeLink(link.getString("url"))) }
    }
}
