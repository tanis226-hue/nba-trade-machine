/** SITE_ID is a documented read-only Netlify Functions runtime variable. */
export const isNetlify=()=>Boolean(process.env.SITE_ID)||process.env.NETLIFY==='true';
