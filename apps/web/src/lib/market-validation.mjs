export const categories = ['Accessories','Fashion','Home & living','Art','Other'];
export const validId = value => typeof value === 'string' && /^[1-9][0-9]{0,17}$/.test(value);
export const validKey = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function validProduct(p) {
 return p && typeof p.name==='string' && p.name.trim().length>=3 && p.name.length<=120 && typeof p.description==='string' && p.description.trim().length>=10 && p.description.length<=3000 && Number.isInteger(p.price_paise) && p.price_paise>=100 && p.price_paise<=100000000 && Number.isInteger(p.stock) && p.stock>=0 && p.stock<=100000 && categories.includes(p.category) && Number.isInteger(p.artwork) && p.artwork>=0 && p.artwork<=2;
}
export function validShipping(s) {
 return s && typeof s.name==='string' && s.name.trim().length>=2 && s.name.length<=100 && typeof s.address==='string' && s.address.trim().length>=10 && s.address.length<=500 && typeof s.phone==='string' && /^[0-9+ ()-]{8,20}$/.test(s.phone) && typeof s.postal==='string' && /^[0-9]{6}$/.test(s.postal);
}
