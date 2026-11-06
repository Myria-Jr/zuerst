export type ThemeMode = "system" | "light" | "dark";
export const themeKey = "zuerst-appearance";
export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "system" || value === "light" || value === "dark";
export const themeBootstrap = `(function(){try{var m=localStorage.getItem('${themeKey}');if(m!=='light'&&m!=='dark')m='system';document.documentElement.dataset.theme=m==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):m;document.documentElement.dataset.themeMode=m;}catch(e){}})();`;
