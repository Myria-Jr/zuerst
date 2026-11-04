package labs.odkaz.zuerst

import java.io.File
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class JournalTest {
    private val catalog = Catalog(File(checkNotNull(System.getProperty("zuerst.catalog"))).readText())

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
