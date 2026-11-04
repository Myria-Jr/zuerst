import type { Ingredient } from '../lib/recipes';

export function IngredientArt({ id }: { id: Ingredient }) {
  const art = {
    paprika: <><path fill="#dc6251" d="M11 8c3-3 6-3 9 0 8-2 9 9 3 15-3 3-5 1-8 2-7 1-10-11-4-17Z"/><path d="M17 9c-1-5 1-6 4-6" stroke="#496647" strokeWidth="2.6" strokeLinecap="round"/><path d="M14 12c-2 3-2 6 0 9m5-9c1 2 1 5 0 8" stroke="#ac443c" strokeWidth="1.2" strokeLinecap="round"/></>,
    eggs: <><path fill="#c58164" d="M7 21c0-6 5-13 9-13 5 0 8 7 8 13a9 9 0 0 1-17 0Z"/><path fill="#f2d0a4" d="M13 17c0-6 5-13 9-13 5 0 8 7 8 13a9 9 0 1 1-17 0Z"/><path d="M18 16c0-2 1-5 3-6" stroke="#fff2db" strokeWidth="1.6" strokeLinecap="round"/></>,
    tomatoes: <><path fill="#df6555" d="M4 18C4 9 12 8 16 10c6-4 13 0 13 7 0 8-5 12-13 12S4 25 4 18Z"/><path fill="#537644" d="m16 7 2-4 2 1-2 5 7 2-6 1 1 4-5-4-6 3 2-4-3-2Z"/><path d="M8 18c0-2 1-3 3-4" stroke="#f8a28d" strokeWidth="1.6" strokeLinecap="round"/></>,
    zucchini: <><path fill="#6b8d51" d="m6 19 15-13c6-4 12 3 7 9L14 28c-6 4-13-4-8-9Z"/><path d="m9 23 15-14m-10 16 11-10" stroke="#9fbd6d" strokeWidth="1.6" strokeLinecap="round"/><path d="m25 6 3-3" stroke="#426441" strokeWidth="2.6" strokeLinecap="round"/></>,
    potatoes: <><path fill="#bc8056" d="M4 18c0-6 5-12 12-13 7-1 13 5 13 12s-5 11-12 11C9 28 4 25 4 18Z"/><path fill="#dcaa71" d="M5 16C7 9 13 5 20 7c5 2 8 6 7 11-1 5-6 7-13 6-6-1-10-3-9-8Z"/><path d="M12 12h1m8 3h1m-6 5h1" stroke="#946040" strokeWidth="2" strokeLinecap="round"/></>,
    carrots: <><path fill="#ee9860" d="M7 25 14 9c3-5 11-1 10 4L10 28c-2 2-4 0-3-3Z"/><path d="m15 13 4 2m-7 3 3 2" stroke="#c4653e" strokeWidth="1.4" strokeLinecap="round"/><path d="M21 8 22 3m0 6 6-4m-5 6 5-1" stroke="#63804c" strokeWidth="2.3" strokeLinecap="round"/></>,
    bread: <><path fill="#b97b53" d="M7 14C1 9 7 4 16 4s15 5 9 10v11c0 2-1 3-3 3H10c-2 0-3-1-3-3Z"/><path fill="#f2c689" d="M10 13C5 10 9 7 16 7s11 3 6 6v11H10Z"/><path d="M13 13h.1m6 4h.1m-5 3h.1" stroke="#c2905c" strokeWidth="2" strokeLinecap="round"/></>,
    pasta: <><path d="M4 10c5 0 5 4 9 4s5-4 9-4h6M4 16c5 0 5 4 9 4s5-4 9-4h6M4 22c5 0 5 4 9 4s5-4 9-4h6" stroke="#d29c4f" strokeWidth="2.7" strokeLinecap="round"/><path d="M4 8c5 0 5 4 9 4s5-4 9-4h6" stroke="#f2c66d" strokeWidth="2.7" strokeLinecap="round"/></>,
    oil: <><rect x="11" y="4" width="10" height="5" rx="2" fill="#617343"/><path d="M12 9h8v4l3 4v10H9V17l3-4Z" fill="#dfb85b"/><path d="M13 19h6v5h-6Z" fill="#fff1cb"/></>,
    salt: <><path d="M11 10h10l3 16H8Z" fill="#e1cfe0"/><rect x="10" y="6" width="12" height="6" rx="3" fill="#9d809d"/><path d="M14 8h.1m4 0h.1" stroke="#fff4e7" strokeWidth="1.6" strokeLinecap="round"/></>,
    water: <path d="M16 4c2 4 9 11 9 16a9 9 0 1 1-18 0c0-5 7-12 9-16Z" fill="#7eabbe"/>,
  };
  return <svg viewBox="0 0 32 32" className="ingredient-art" aria-hidden="true">
    {id in art ? art[id as keyof typeof art] : <><path d="M8 25C1 12 11 5 26 6c2 14-5 22-16 21Z" fill="#9cbb70"/><path d="M6 28c4-8 10-13 16-17" stroke="#577047" strokeWidth="2" strokeLinecap="round"/></>}
  </svg>;
}
