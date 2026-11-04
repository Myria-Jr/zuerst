package labs.odkaz.zuerst

import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale

internal data class Ingredient(val id: String, val name: String, val aliases: List<String>)
internal data class Amount(val id: String, val amount: String)
internal data class Recipe(val id: String, val name: String, val minutes: Int, val note: String, val items: List<Amount>, val steps: List<String>)
internal data class Candidate(val recipe: Recipe, val used: List<String>, val missing: List<String>)
internal data class Matches(val complete: List<Candidate>, val almost: Candidate?)

private val diacritics = Regex("\\p{M}+")
private val spaces = Regex("\\s+")
private fun normalize(value: String): String = Normalizer.normalize(value.lowercase(Locale.GERMAN).replace("ß", "ss"), Normalizer.Form.NFD)
    .replace(diacritics, "").trim()

internal class Catalog(json: String) {
    private val source = JSONObject(json)
    val ingredients = source.getJSONArray("ingredients").map { index ->
        getJSONObject(index).let { Ingredient(it.getString("id"), it.getString("name"), it.getJSONArray("aliases").strings()) }
    }
    private val byId = ingredients.associateBy(Ingredient::id)
    private val indexed = ingredients.associateWith { (listOf(it.name) + it.aliases).map(::normalize) }
    val quick = source.getJSONArray("quick").strings()
    val pantry = source.getJSONArray("pantry").strings().toSet()
    val recipes = source.getJSONArray("recipes").map { index ->
        val recipe = getJSONObject(index)
        Recipe(recipe.getString("id"), recipe.getString("name"), recipe.getInt("minutes"), recipe.getString("note"),
            recipe.getJSONArray("items").map { item -> getJSONObject(item).let { Amount(it.getString("id"), it.getString("amount")) } },
            recipe.getJSONArray("steps").strings())
    }

    fun name(id: String) = byId.getValue(id).name

    fun search(query: String): List<String> {
        val terms = normalize(query).split(spaces).filter(String::isNotEmpty)
        val value = terms.joinToString(" ")
        val collator = java.text.Collator.getInstance(Locale.GERMAN)
        return indexed.mapNotNull { (ingredient, names) ->
            if (!terms.all { term -> names.any { term in it } }) null
            else ingredient to when { value in names -> 0; names.any { it.startsWith(value) } -> 1; else -> 2 }
        }.sortedWith(compareBy<Pair<Ingredient, Int>> { it.second }.thenComparator { a, b -> collator.compare(a.first.name, b.first.name) })
            .map { it.first.id }
    }

    fun matches(picked: List<String>, confirmed: Collection<String>): Matches {
        val candidates = candidates(picked, (picked + confirmed).toSet())
            .sortedWith(compareByDescending<Candidate> { it.used.size }.thenBy { it.recipe.minutes })
        return Matches(candidates.filter { it.missing.isEmpty() }, candidates.firstOrNull { it.missing.size == 1 })
    }

    fun choices(picked: List<String>): List<String> = candidates(picked, picked.toSet())
        .sortedWith(compareByDescending<Candidate> { it.used.size }.thenBy { it.missing.size }.thenBy { it.recipe.minutes })
        .flatMap(Candidate::missing).distinct().take(4)

    private fun candidates(picked: List<String>, present: Set<String>): List<Candidate> {
        val first = picked.firstOrNull() ?: return emptyList()
        return recipes.mapNotNull { recipe ->
            val required = recipe.items.map(Amount::id)
            if (first in required) Candidate(recipe, picked.filter { it in required }, required.filterNot { it in present }) else null
        }
    }
}

private fun <T> JSONArray.map(transform: JSONArray.(Int) -> T): List<T> = List(length()) { transform(it) }
private fun JSONArray.strings(): List<String> = map { getString(it) }
