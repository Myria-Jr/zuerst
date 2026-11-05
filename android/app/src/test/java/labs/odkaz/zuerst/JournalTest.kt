package labs.odkaz.zuerst

import java.io.File
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JournalTest {
    private val catalog = Catalog(File(checkNotNull(System.getProperty("zuerst.catalog"))).readText())

    @Test fun journalMigrationAndShoppingKeepUnknownIngredientsUnconfirmed() {
        val journal = Journal.parse("""{"stock":["paprika","paprika","unknown"],"meals":[]}""", catalog)
        assertEquals(listOf("paprika"), journal.stock)
        val recipe = catalog.recipes.first { it.id == "paprika-eier" }
        val shopping = journal.buyMissing(recipe)
        assertEquals(listOf("eggs", "oil", "salt"), shopping.shopping)
        assertTrue(catalog.ready(shopping.stock).isEmpty())
        val planned = shopping.plan(LocalDate.of(2026, 11, 5), recipe).favorite(recipe.id)
        val restored = Journal.parse(planned.json().toString(), catalog)
        assertEquals(planned, restored)
        val bought = restored.bought(restored.shopping)
        assertTrue(bought.shopping.isEmpty())
        assertTrue(catalog.ready(bought.stock).any { it.id == recipe.id })
    }

    @Test fun receiptsIdentifyIngredientsWithoutInventingAvailability() {
        val receipt = "BIO EIER 10 ST 2,49\nPAPRIKA ROT 1,19\nPAPRIKA CHIPS 1,99\nRABATT BROT 0,30\nBASMATI REIS 1,79\nEIER 2,49\nSUMME 9,55"
        assertEquals(listOf("eggs", "paprika"), catalog.receipt(receipt))
        val journal = Journal().addStock(catalog.receipt(receipt)).addStock(listOf("paprika"))
        assertEquals(listOf("eggs", "paprika"), journal.stock)
        assertTrue(catalog.ready(journal.stock).isEmpty())
        assertEquals("paprika-eier", catalog.ready(journal.addStock(listOf("oil", "salt")).stock).first().id)
    }

    @Test fun rollingHistoryCountsOnlyLoggedMealsAndSurvivesDeletion() {
        val today = LocalDate.of(2026, 11, 4)
        val recipe = catalog.recipes.first()
        val journal = Journal().cooked(recipe, today.minusDays(7)).cooked(recipe, today.minusDays(6)).cooked(recipe, today)
        assertEquals(listOf(1, 0, 0, 0, 0, 0, 1), journal.counts(today).map { it.second })
        assertEquals(recipe.items.count { it.id !in catalog.pantry }, journal.variety(catalog.pantry, today))
        assertEquals(1, journal.removeMeal(journal.meals.first().id).counts(today).sumOf { it.second })
    }
}
