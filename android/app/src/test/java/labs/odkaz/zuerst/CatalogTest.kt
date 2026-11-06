package labs.odkaz.zuerst

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogTest {
    private val catalog = Catalog(File(checkNotNull(System.getProperty("zuerst.catalog"))).readText())

    @Test fun paprikaAndEggsRequireExplicitPantryConfirmation() {
        val picked = listOf("paprika", "eggs")
        assertEquals(listOf("oil", "salt", "rice", "cannedtomatoes"), catalog.choices(picked))
        assertTrue(catalog.matches(picked, emptyList()).complete.isEmpty())
        assertEquals(listOf("oil"), catalog.matches(picked, listOf("salt")).almost?.missing)
        assertEquals("paprika-eier", catalog.matches(picked, listOf("oil", "salt")).complete.single().recipe.id)
    }

    @Test fun mainIngredientAndRankingMatchTheWebApp() {
        val pantry = listOf("oil", "salt", "cannedtomatoes")
        val matches = catalog.matches(listOf("paprika", "eggs", "rice"), pantry)
        assertEquals(listOf("paprika-reis", "paprika-eier", "shakshuka"), matches.complete.map { it.recipe.id })
        val empty = catalog.matches(listOf("cucumber", "paprika", "eggs"), pantry)
        assertTrue(empty.complete.isEmpty())
        assertNull(empty.almost)
        assertEquals("carrots", catalog.search("MOHREN").first())
        assertTrue(catalog.recipes.size > 200)
        assertTrue(catalog.recipes.all { it.minutes in 1..20 && it.items.isNotEmpty() && it.steps.isNotEmpty() })
    }
}
