const testTerms = /test|series|mock/i;
function formatQuery(format) {
    const legacy = { $or: [{ title: testTerms }, { category: testTerms }] };
    if (!['tests', 'video'].includes(format)) return {};
    return { $or: [ { deliveryType: format }, { $and: [
        { deliveryType: { $nin: ['tests', 'video'] } },
        format === 'tests' ? legacy : { $nor: legacy.$or }
    ] } ] };
}
function catalogQuery({format, category, price, search} = {}) {
    const clauses = [{ isPublished: true }, formatQuery(format)];
    if (category === 'Test Series') clauses.push(formatQuery('tests'));
    else if (category && category !== 'all') {
        const pattern = category === 'Paper 1' ? /paper\s*1\b/i : new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        clauses.push({ $or: [{ category: pattern }, { title: pattern }] });
    }
    if (price === 'free') clauses.push({price:0});
    if (price === 'paid') clauses.push({price:{$gt:0}});
    if (typeof search === 'string' && search.trim()) clauses.push({title:{$regex:search.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}});
    return {$and:clauses};
}
module.exports = { catalogQuery };
