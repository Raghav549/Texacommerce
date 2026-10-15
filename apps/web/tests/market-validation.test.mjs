import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validId,validKey,validProduct,validShipping} from '../src/lib/market-validation.mjs';
test('IDs and checkout keys reject ambiguous and injectable values',()=>{
 assert.equal(validId('123'),true);for(const value of [1,'0','-1','1 OR 1=1','1.0',null,'9'.repeat(19)])assert.equal(validId(value),false);
 assert.equal(validKey('12345678-1234-4234-8234-123456789abc'),true);assert.equal(validKey('invalid'),false);
});
test('listing accepts integer paise, never arbitrary float prices or stock',()=>{
 const p={name:'Handmade cup',description:'Made by hand with care.',price_paise:99900,stock:3,category:'Art',artwork:2};assert.equal(validProduct(p),true);
 for(const patch of [{price_paise:-1},{price_paise:1.5},{stock:1.5},{stock:100001},{category:'Anything'},{artwork:99},{name:' '},{description:''}])assert.equal(Boolean(validProduct({...p,...patch})),false);
});
test('Indian shipping has bounded fields and six-digit postal code',()=>{
 const s={name:'Test Buyer',address:'123 Example Road, Gaya, Bihar',phone:'+919999999999',postal:'823001'};assert.equal(Boolean(validShipping(s)),true);
 for(const patch of [{postal:'123'},{phone:'<script>'},{address:'short'},{name:'x'},{address:'x'.repeat(501)}])assert.equal(Boolean(validShipping({...s,...patch})),false);
});
