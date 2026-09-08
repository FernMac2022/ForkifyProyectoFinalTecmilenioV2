import { API_URL, RES_PER_PAGE, KEY } from './config.js';
import { AJAX } from './helpers.js';

export const state = {
  recipe: {},
  search: {
    query: '',
    results: [],
    page: 1,
    resultsPerPage: RES_PER_PAGE,
  },
  bookmarks: [],
};

const apiUrl = function (suffix = '', params = {}) {
  const url = new URL(`${API_URL}${suffix}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  if (KEY) url.searchParams.set('key', KEY);
  return url.toString();
};

const createRecipeObject = function (data) {
  const { recipe } = data.data;
  return {
    id: recipe.id,
    title: recipe.title,
    publisher: recipe.publisher,
    sourceUrl: recipe.source_url,
    image: recipe.image_url?.replace(/^http:\/\//i, 'https://'),
    servings: recipe.servings,
    cookingTime: recipe.cooking_time,
    ingredients: recipe.ingredients,
    ...(recipe.key && { key: recipe.key }),
  };
};

export const loadRecipe = async function (id) {
  try {
    const data = await AJAX(apiUrl(`/${id}`));
    state.recipe = createRecipeObject(data);
    state.recipe.bookmarked = state.bookmarks.some(bookmark => bookmark.id === id);
  } catch (err) {
    console.error(`${err} 💥`);
    throw err;
  }
};

export const loadSearchResults = async function (query) {
  try {
    state.search.query = query;
    const data = await AJAX(apiUrl('', { search: query }));

    state.search.results = data.data.recipes.map(rec => ({
      id: rec.id,
      title: rec.title,
      publisher: rec.publisher,
      image: rec.image_url?.replace(/^http:\/\//i, 'https://'),
      ...(rec.key && { key: rec.key }),
    }));
    state.search.page = 1;
  } catch (err) {
    console.error(`${err} 💥`);
    throw err;
  }
};

export const getSearchResultsPage = function (page = state.search.page) {
  state.search.page = page;
  const start = (page - 1) * state.search.resultsPerPage;
  const end = page * state.search.resultsPerPage;
  return state.search.results.slice(start, end);
};

export const updateServings = function (newServings) {
  state.recipe.ingredients.forEach(ing => {
    if (ing.quantity != null)
      ing.quantity = (ing.quantity * newServings) / state.recipe.servings;
  });
  state.recipe.servings = newServings;
};

const persistBookmarks = function () {
  localStorage.setItem('bookmarks', JSON.stringify(state.bookmarks));
};

export const addBookmark = function (recipe) {
  state.bookmarks.push(recipe);
  if (recipe.id === state.recipe.id) state.recipe.bookmarked = true;
  persistBookmarks();
};

export const deleteBookmark = function (id) {
  const index = state.bookmarks.findIndex(el => el.id === id);
  if (index !== -1) state.bookmarks.splice(index, 1);
  if (id === state.recipe.id) state.recipe.bookmarked = false;
  persistBookmarks();
};

const init = function () {
  const storage = localStorage.getItem('bookmarks');
  if (storage) {
    try {
      state.bookmarks = JSON.parse(storage);
    } catch {
      state.bookmarks = [];
    }
  }
};
init();

export const uploadRecipe = async function (newRecipe) {
  try {
    if (!KEY)
      throw new Error(
        'A Forkify API key is required to upload recipes. Generate one at forkify-api.jonas.io and add it to src/js/config.js.'
      );

    const ingredients = Object.entries(newRecipe)
      .filter(entry => entry[0].startsWith('ingredient') && entry[1].trim() !== '')
      .map(ing => {
        const ingArr = ing[1].split(',').map(el => el.trim());
        if (ingArr.length !== 3)
          throw new Error(
            "Wrong ingredient format. Please use: 'Quantity,Unit,Description'."
          );

        const [quantity, unit, description] = ingArr;
        const quantityValue = quantity ? +quantity : null;
        if (quantity && Number.isNaN(quantityValue))
          throw new Error('Ingredient quantity must be a number or left blank.');
        if (!description)
          throw new Error('Each ingredient must include a description.');

        return { quantity: quantityValue, unit, description };
      });

    if (ingredients.length === 0)
      throw new Error('Please provide at least one ingredient.');

    const recipe = {
      title: newRecipe.title.trim(),
      source_url: newRecipe.sourceUrl.trim(),
      image_url: newRecipe.image.trim(),
      publisher: newRecipe.publisher.trim(),
      cooking_time: +newRecipe.cookingTime,
      servings: +newRecipe.servings,
      ingredients,
    };

    const data = await AJAX(apiUrl(), recipe);
    state.recipe = createRecipeObject(data);
    addBookmark(state.recipe);
  } catch (err) {
    throw err;
  }
};
