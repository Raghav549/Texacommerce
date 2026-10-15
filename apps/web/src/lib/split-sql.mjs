// Migration source is trusted. Preserve quoted strings, comments and dollar-quoted functions.
export function splitSql(source) {
 const statements = []; let current = '', quote = null, dollar = null, comment = false;
 for (let i=0;i<source.length;i++) {
  const c=source[i], next=source[i+1];
  if (comment) { if (c==='\n') { comment=false; current+='\n'; } continue; }
  if (dollar) { if (source.startsWith(dollar,i)) { current+=dollar; i+=dollar.length-1; dollar=null; } else current+=c; continue; }
  if (quote) { current+=c; if(c===quote) { if(next===quote) { current+=next; i++; } else quote=null; } continue; }
  if(c==='-' && next==='-') { comment=true; i++; continue; }
  if(c==="'" || c==='"') { quote=c; current+=c; continue; }
  if(c==='$') { const match=source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/); if(match) { dollar=match[0]; current+=dollar; i+=dollar.length-1; continue; } }
  if(c===';') { if(current.trim()) statements.push(current.trim()); current=''; } else current+=c;
 }
 if(quote || dollar) throw new Error('Unterminated SQL quote');
 if(current.trim()) statements.push(current.trim());
 return statements;
}
