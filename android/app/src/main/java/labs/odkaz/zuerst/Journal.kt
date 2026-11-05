package labs.odkaz.zuerst

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.util.UUID

internal data class Meal(val id: String, val name: String, val day: LocalDate, val ingredients: List<String>)
internal data class MealPlan(val day: LocalDate, val recipeId: String)

internal data class Journal(
    val stock: List<String> = emptyList(), val meals: List<Meal> = emptyList(),
    val favorites: List<String> = emptyList(), val shopping: List<String> = emptyList(),
    val plans: List<MealPlan> = emptyList(), val name: String = "", val expiry: Map<String, LocalDate> = emptyMap(),
) {
    fun addStock(ids: Collection<String>) = copy(stock = (stock + ids).distinct())
    fun removeStock(id: String) = copy(stock = stock - id, expiry = expiry - id)
    fun favorite(id: String) = copy(favorites = if (id in favorites) favorites - id else favorites + id)
    fun missing(recipe: Recipe) = recipe.items.map(Amount::id).filterNot { it in stock }
    fun buyMissing(recipe: Recipe) = copy(shopping = (shopping + missing(recipe)).distinct())
    fun bought(ids: List<String>) = addStock(ids).copy(shopping = shopping - ids.toSet())
    fun plan(day: LocalDate, recipe: Recipe) = copy(plans = plans.filterNot { it.day == day } + MealPlan(day, recipe.id))
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

    fun json(): JSONObject = JSONObject().put("version", 2).put("stock", JSONArray(stock))
        .put("meals", JSONArray(meals.map { JSONObject().put("id", it.id).put("name", it.name).put("day", it.day.toString()).put("ingredients", JSONArray(it.ingredients)) }))
        .put("favorites", JSONArray(favorites)).put("shopping", JSONArray(shopping)).put("name", name)
        .put("plans", JSONArray(plans.map { JSONObject().put("day", it.day.toString()).put("recipeId", it.recipeId) }))
        .put("expiry", JSONObject(expiry.mapValues { it.value.toString() }))

    companion object {
        fun parse(source: String, catalog: Catalog): Journal {
            require(source.toByteArray().size <= 1_000_000) { "Die Sicherung ist zu groß (maximal 1 MB)." }
            val data = JSONObject(source)
            require(!data.has("version") || data.getInt("version") == 2) { "Diese Sicherung benötigt eine neuere App-Version." }
            data.getJSONArray("stock"); data.getJSONArray("meals")
            val valid = catalog.ingredients.map(Ingredient::id).toSet()
            val recipeIds = catalog.recipes.map(Recipe::id).toSet()
            fun ids(array: JSONArray?, allowed: Set<String>): List<String> = array?.let { List(it.length()) { i -> it.optString(i) }.filter { it in allowed }.distinct() }.orEmpty()
            val stock = ids(data.optJSONArray("stock"), valid)
            val meals = data.getJSONArray("meals").let { array -> List(array.length().coerceAtMost(10_000)) { array.optJSONObject(it) }.mapNotNull { item ->
                item ?: return@mapNotNull null
                runCatching { Meal(item.getString("id").take(100), item.getString("name").take(160), LocalDate.parse(item.getString("day")), ids(item.optJSONArray("ingredients"), valid)) }.getOrNull()
            }.distinctBy(Meal::id) }
            val plans = data.optJSONArray("plans")?.let { array -> List(array.length()) { array.optJSONObject(it) }.mapNotNull { item ->
                item ?: return@mapNotNull null
                runCatching { MealPlan(LocalDate.parse(item.getString("day")), item.getString("recipeId")) }.getOrNull()?.takeIf { it.recipeId in recipeIds }
            }.distinctBy(MealPlan::day).take(366) }.orEmpty()
            val expiry = data.optJSONObject("expiry")?.let { obj -> obj.keys().asSequence().filter { it in stock }.mapNotNull { id ->
                runCatching { id to LocalDate.parse(obj.getString(id)) }.getOrNull()
            }.toMap() }.orEmpty()
            return Journal(stock, meals, ids(data.optJSONArray("favorites"), recipeIds), ids(data.optJSONArray("shopping"), valid), plans, data.optString("name").take(40), expiry)
        }
    }
}

internal class JournalStore(context: Context, private val catalog: Catalog) {
    private val settings = context.getSharedPreferences("kitchen_journal", Context.MODE_PRIVATE)

    fun load(): Journal {
        val source = settings.getString("journal", null) ?: return Journal()
        return runCatching { Journal.parse(source, catalog) }.getOrDefault(Journal())
    }

    fun save(journal: Journal) {
        settings.edit().putString("journal", journal.json().toString()).apply()
    }
}
