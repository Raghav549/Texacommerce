import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readObject} from '../src/lib/read-json.mjs';
const req=body=>new Request('https://texa.example/api/community/posts',{method:'POST',body});
test('JSON body parsing rejects non-objects, malformed and oversized requests',async()=>{
 assert.deepEqual(await readObject(req('{"body":"hello"}')),{body:'hello'});
 for(const value of ['null','[]','1','"hello"','{bad'])await assert.rejects(readObject(req(value)),e=>e.status===400);
 await assert.rejects(readObject(req(JSON.stringify({body:'x'.repeat(20000)}))),e=>e.status===413);
});
