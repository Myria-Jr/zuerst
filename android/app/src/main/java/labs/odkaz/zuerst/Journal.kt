package labs.odkaz.zuerst

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.util.UUID

internal data class Meal(val id: String, val name: String, val day: LocalDate, val ingredients: List<String>)

internal data class Journal(val stock: List<String> = emptyList(), val meals: List<Meal> = emptyList()) {
    fun addStock(ids: Collection<String>) = copy(stock = (stock + ids).distinct())
    fun removeStock(id: String) = copy(stock = stock - id)
    fun cooked(recipe: Recipe, day: LocalDate = LocalDate.now()) = copy(
        meals = listOf(Meal(UUID.randomUUID().toString(), recipe.name, day, recipe.items.map(Amount::id))) + meals,
    )
    fun removeMeal(id: String) = copy(meals = meals.filterNot { it.id == id })
    fun counts(today: LocalDate = LocalDate.now()): List<Pair<LocalDate, Int>> {
        val counts = meals.groupingBy(Meal::day).eachCount()
        return (6 downTo 0).map { offset -> today.minusDays(offset.toLong()).let { it to (counts[it] ?: 0) } }
    }

    fun variety(pantry: Set<String>, today: LocalDate = LocalDate.now()): Int = meals.asSequence()
        .filter { it.day in today.minusDays(6)..today }
        .flatMap { it.ingredients.asSequence() }.filterNot { it in pantry }.distinct().count()
}

internal class JournalStore(context: Context, private val catalog: Catalog) {
    private val settings = context.getSharedPreferences("kitchen_journal", Context.MODE_PRIVATE)

    fun load(): Journal {
        val source = settings.getString("journal", null) ?: return Journal()
        return runCatching {
            val data = JSONObject(source)
            val stock = data.getJSONArray("stock")
            val valid = catalog.ingredients.map(Ingredient::id).toSet()
            val meals = data.getJSONArray("meals")
            Journal(List(stock.length()) { stock.getString(it) }.filter { it in valid }.distinct(),
                List(meals.length()) { meals.getJSONObject(it) }.mapNotNull { item ->
                    runCatching {
                        val ids = item.optJSONArray("ingredients")
                        val ingredients = if (ids == null) emptyList() else List(ids.length()) { ids.getString(it) }
                        Meal(item.getString("id"), item.getString("name"), LocalDate.parse(item.getString("day")), ingredients)
                    }.getOrNull()
                })
        }.getOrDefault(Journal())
    }

    fun save(journal: Journal) {
        val meals = journal.meals.map {
            JSONObject().put("id", it.id).put("name", it.name).put("day", it.day.toString()).put("ingredients", JSONArray(it.ingredients))
        }
        val data = JSONObject().put("stock", JSONArray(journal.stock)).put("meals", JSONArray(meals))
        settings.edit().putString("journal", data.toString()).apply()
    }
}
