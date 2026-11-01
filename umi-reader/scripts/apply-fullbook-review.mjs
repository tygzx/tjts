/**
 * Apply manually reviewed data without mutating either input or writing files.
 *
 * applyFullbookReview(book, {
 *   glosses: [{p, b, d}],
 *   repairs: [{sentence, old, tokens:[{s,k,b?,p,d,r?,f?,ct?}]}],
 *   contexts: [{sentence,s,definition,base?,p?,k?}]
 * }) -> {book, report}
 *
 * Sentences and optional `occurrence` selectors are one-based. Without an
 * occurrence selector every exact occurrence is considered. Character offsets
 * in the report and line.studyGlosses use JS/UTF-16 string offsets [start,end).
 * Conflicting or unaligned operations are reported and not applied. Independent
 * valid operations can still succeed; callers must inspect report.ok before
 * publishing. Repairs may merge multiple whole tokens or explicitly split a
 * whole token, but may not start/end inside a token. No reading is inferred.
 *
 * Old dictionary entries/IDs remain unchanged, including unused bad entries.
 * New reviewed variants are appended and only live line.t references redirected.
 * Quiz builders must use line.t or report.activeWordIds, never the whole dictionary.
 * Explicit repair definitions take precedence over lemma-wide glossary entries.
 * Context definitions stay on their own line; UI integration is intentionally
 * separate and must honor the stored character span when merging learning units.
 */

const clone=value=>structuredClone(value);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.length>0;
const canonical=value=>JSON.stringify(sortKeys(value));
function sortKeys(value){
 if(Array.isArray(value))return value.map(sortKeys);
 if(object(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sortKeys(value[k])]));
 return value;
}
const lemmaKey=w=>JSON.stringify([w.p,w.b]);
const overlaps=(a,b)=>a.start<b.end&&b.start<a.end;

function validateBook(book){
 if(!object(book)||!Array.isArray(book.words)||!Array.isArray(book.lines))throw new TypeError('book.words and book.lines must be arrays');
 for(const [i,w] of book.words.entries())if(!object(w)||!nonempty(w.s))throw new TypeError(`Invalid dictionary surface at word ID ${i}`);
 for(const [i,line] of book.lines.entries()){
  if(!object(line)||!Array.isArray(line.t))throw new TypeError(`Missing token list at sentence ${i+1}`);
  for(const id of line.t)if(!Number.isInteger(id)||id<0||id>=book.words.length)throw new TypeError(`Invalid word ID ${id} at sentence ${i+1}`);
  if(own(line,'studyGlosses')&&!Array.isArray(line.studyGlosses))throw new TypeError(`studyGlosses must be an array at sentence ${i+1}`);
 }
}

function layout(book,line){
 const boundaries=new Map([[0,0]]);let text='';
 for(const [i,id] of line.t.entries()){text+=book.words[id].s;boundaries.set(text.length,i+1);}
 return {text,boundaries};
}

function normalizeToken(w){
 if(!object(w)||!nonempty(w.s)||!nonempty(w.k)||!nonempty(w.p)||typeof w.d!=='string'||(!w.d&&w.p!=='标点'))return null;
 if(own(w,'b')&&!nonempty(w.b))return null;
 for(const key of ['r','f','ct'])if(own(w,key)&&typeof w[key]!=='string')return null;
 if(w.auto===true)return null; // Machine candidates are not review approvals.
 return {s:w.s,k:w.k,r:w.r??'',b:w.b??w.s,p:w.p,f:w.f??'',ct:w.ct??'',d:w.d,auto:false};
}

function allOccurrences(text,surface){
 const found=[];let from=0;
 while(from<=text.length-surface.length){const at=text.indexOf(surface,from);if(at<0)break;found.push(at);from=at+1;}
 return found;
}

/** @returns {{book:object,report:object}} A detached book plus detailed diagnostics. */
export function applyFullbookReview(inputBook,reviewData={}){
 validateBook(inputBook);
 if(!object(reviewData))throw new TypeError('reviewData must be an object');
 const book=clone(inputBook),initialWordCount=book.words.length;
 const before=book.lines.map(line=>layout(book,line).text);
 const report={ok:true,applied:{repairs:[],glosses:[],contexts:[]},unchanged:{repairs:[],contexts:[]},duplicates:[],issues:[],activeWordIds:[],inactiveWordIds:[],stats:{}};
 const issue=(severity,code,details)=>report.issues.push({severity,code,...details});
 const rules=name=>{
  if(!own(reviewData,name))return [];
  if(!Array.isArray(reviewData[name])){issue('error','invalid_review_array',{kind:name});return [];}
  return reviewData[name];
 };
 const dictionary=new Map();
 book.words.forEach((w,id)=>{const key=canonical(w);if(!dictionary.has(key))dictionary.set(key,id);});
 const idFor=word=>{
  const key=canonical(word);
  if(!dictionary.has(key)){dictionary.set(key,book.words.length);book.words.push(clone(word));}
  return dictionary.get(key);
 };
 // Protection is occurrence-local: a reviewed token's contextual definition
 // must not leak into unrelated references with the same lemma or word ID.
 const protectedTokens=book.lines.map(line=>line.t.map(()=>false));

 function candidateSpans(rule,kind,ruleIndex,surface){
  if(!object(rule)||!Number.isInteger(rule.sentence)||rule.sentence<1||rule.sentence>book.lines.length||!nonempty(surface)){
   issue('error','invalid_rule',{kind,ruleIndex,sentence:rule?.sentence});return [];
  }
  if(own(rule,'occurrence')&&(!Number.isInteger(rule.occurrence)||rule.occurrence<1)){
   issue('error','invalid_occurrence',{kind,ruleIndex,sentence:rule.sentence});return [];
  }
  const {text,boundaries}=layout(book,book.lines[rule.sentence-1]);
  const positions=allOccurrences(text,surface);
  const selected=own(rule,'occurrence')?positions.slice(rule.occurrence-1,rule.occurrence):positions;
  if(!selected.length){issue('error','source_not_found',{kind,ruleIndex,sentence:rule.sentence,surface,occurrence:rule.occurrence});return [];}
  return selected.flatMap(start=>{
   const end=start+surface.length;
   if(!boundaries.has(start)||!boundaries.has(end)){
    const touched=[];let offset=0;
    for(const id of book.lines[rule.sentence-1].t){const w=book.words[id],stop=offset+w.s.length;if(offset<end&&start<stop)touched.push({id,s:w.s,start:offset,end:stop});offset=stop;}
    issue('error','boundary_mismatch',{kind,ruleIndex,sentence:rule.sentence,surface,start,end,touched});return [];
   }
   return [{sentence:rule.sentence,start,end,startToken:boundaries.get(start),endToken:boundaries.get(end),ruleIndex}];
  });
 }

 function rejectOverlaps(candidates,kind){
  const unique=[],bySpan=new Map();
  for(const candidate of candidates){
   const key=JSON.stringify([candidate.sentence,candidate.start,candidate.end,candidate.payloadKey]);
   if(bySpan.has(key)){report.duplicates.push({kind,ruleIndex:candidate.ruleIndex,duplicateOf:bySpan.get(key).ruleIndex,sentence:candidate.sentence,start:candidate.start,end:candidate.end});continue;}
   unique.push(candidate);bySpan.set(key,candidate);
  }
  unique.sort((a,b)=>a.sentence-b.sentence||a.start-b.start||a.end-b.end||a.ruleIndex-b.ruleIndex);
  const blocked=new Set();
  for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
   const a=unique[i],b=unique[j];if(b.sentence!==a.sentence||b.start>=a.end)break;
   if(overlaps(a,b)){
    blocked.add(a);blocked.add(b);
    issue('error','overlapping_rules',{kind,sentence:a.sentence,rules:[a.ruleIndex,b.ruleIndex],spans:[[a.start,a.end],[b.start,b.end]]});
   }
  }
  return unique.filter(candidate=>!blocked.has(candidate));
 }

 const repairCandidates=[];
 for(const [ruleIndex,rule] of rules('repairs').entries()){
  if(!object(rule)||!Array.isArray(rule.tokens)||!rule.tokens.length){issue('error','invalid_repair',{kind:'repairs',ruleIndex});continue;}
  const tokens=rule.tokens.map(normalizeToken);
  if(tokens.some(t=>!t)){issue('error','unreviewed_or_incomplete_token',{kind:'repairs',ruleIndex,sentence:rule.sentence});continue;}
  if(tokens.map(t=>t.s).join('')!==rule.old){issue('error','source_would_change',{kind:'repairs',ruleIndex,sentence:rule.sentence,old:rule.old,replacement:tokens.map(t=>t.s).join('')});continue;}
  for(const span of candidateSpans(rule,'repairs',ruleIndex,rule.old))repairCandidates.push({...span,old:rule.old,tokens,payloadKey:canonical(tokens)});
 }
 const repairPlans=rejectOverlaps(repairCandidates,'repairs');
 const plansBySentence=new Map();
 for(const plan of repairPlans){if(!plansBySentence.has(plan.sentence))plansBySentence.set(plan.sentence,[]);plansBySentence.get(plan.sentence).push(plan);}
 for(const [sentence,plans] of plansBySentence){
  const line=book.lines[sentence-1],next=[],protection=[];let cursor=0;
  for(const plan of plans){
   while(cursor<plan.startToken){next.push(line.t[cursor++]);protection.push(false);}
   const oldIds=line.t.slice(plan.startToken,plan.endToken),newIds=plan.tokens.map(idFor);
   next.push(...newIds);protection.push(...newIds.map(()=>true));cursor=plan.endToken;
   const info={sentence,ruleIndex:plan.ruleIndex,old:plan.old,start:plan.start,end:plan.end,oldIds,newIds};
   if(canonical(oldIds)===canonical(newIds))report.unchanged.repairs.push(info);else report.applied.repairs.push(info);
  }
  while(cursor<line.t.length){next.push(line.t[cursor++]);protection.push(false);}
  line.t=next;protectedTokens[sentence-1]=protection;
 }

 const glossary=new Map(),conflictingGlosses=new Set(),glossCounts=new Map();
 for(const [ruleIndex,rule] of rules('glosses').entries()){
  if(!object(rule)||!nonempty(rule.p)||!nonempty(rule.b)||!nonempty(rule.d)||rule.auto===true){issue('error','invalid_gloss',{kind:'glosses',ruleIndex});continue;}
  const key=lemmaKey(rule),old=glossary.get(key);
  if(old){
   if(old.d!==rule.d){conflictingGlosses.add(key);issue('error','conflicting_glosses',{kind:'glosses',rules:[old.ruleIndex,ruleIndex],p:rule.p,b:rule.b});}
   else report.duplicates.push({kind:'glosses',ruleIndex,duplicateOf:old.ruleIndex,p:rule.p,b:rule.b});
   continue;
  }
  glossary.set(key,{p:rule.p,b:rule.b,d:rule.d,ruleIndex});glossCounts.set(key,{active:0,protected:0,changed:0});
 }
 const changedGlosses=new Map();
 for(const [lineIndex,line] of book.lines.entries())for(const [tokenIndex,id] of line.t.entries()){
  const word=book.words[id],key=lemmaKey(word),gloss=glossary.get(key);if(!gloss||conflictingGlosses.has(key))continue;
  const count=glossCounts.get(key);count.active++;
  if(protectedTokens[lineIndex][tokenIndex]){count.protected++;continue;}
  const newId=idFor({...word,d:gloss.d,auto:false});if(newId===id)continue;
  line.t[tokenIndex]=newId;count.changed++;
  const keyPair=JSON.stringify([id,newId]);
  if(!changedGlosses.has(keyPair))changedGlosses.set(keyPair,{ruleIndex:gloss.ruleIndex,p:gloss.p,b:gloss.b,oldId:id,newId,occurrences:0,sentences:[]});
  const change=changedGlosses.get(keyPair);change.occurrences++;if(change.sentences.at(-1)!==lineIndex+1)change.sentences.push(lineIndex+1);
 }
 report.applied.glosses=[...changedGlosses.values()];
 for(const [key,count] of glossCounts){
  if(conflictingGlosses.has(key))continue;
  const gloss=glossary.get(key);
  if(!count.active)issue('warning','gloss_not_active',{kind:'glosses',ruleIndex:gloss.ruleIndex,p:gloss.p,b:gloss.b});
  else if(count.active===count.protected)issue('info','gloss_shadowed_by_repairs',{kind:'glosses',ruleIndex:gloss.ruleIndex,p:gloss.p,b:gloss.b,occurrences:count.active});
 }

 const contextCandidates=[];
 for(const [ruleIndex,rule] of rules('contexts').entries()){
  if(!object(rule)||!nonempty(rule.definition)||['base','p','k'].some(k=>own(rule,k)&&!nonempty(rule[k]))||rule.auto===true){issue('error','invalid_context',{kind:'contexts',ruleIndex});continue;}
  for(const span of candidateSpans(rule,'contexts',ruleIndex,rule.s)){
   const value={s:rule.s,start:span.start,end:span.end,definition:rule.definition,definitionReviewed:true,definitionScope:'context'};
   for(const k of ['base','p','k'])if(own(rule,k))value[k]=rule[k];
   contextCandidates.push({...span,value,payloadKey:canonical(value)});
  }
 }
 for(const plan of rejectOverlaps(contextCandidates,'contexts')){
  const line=book.lines[plan.sentence-1],existing=line.studyGlosses??[];
  const same=existing.find(g=>canonical(g)===canonical(plan.value));
  const info={sentence:plan.sentence,ruleIndex:plan.ruleIndex,s:plan.value.s,start:plan.start,end:plan.end};
  if(same){report.unchanged.contexts.push(info);continue;}
  const clashes=existing.filter(g=>Number.isInteger(g.start)&&Number.isInteger(g.end)&&overlaps(g,plan));
  if(clashes.length){issue('error','conflicting_existing_context',{kind:'contexts',...info,existing:clone(clashes)});continue;}
  // Legacy entries without spans could otherwise silently compete with this one.
  const legacy=existing.filter(g=>!Number.isInteger(g.start)&&g.s===plan.value.s);
  if(legacy.length){issue('error','unanchored_existing_context',{kind:'contexts',...info,existing:clone(legacy)});continue;}
  line.studyGlosses=[...existing,plan.value].sort((a,b)=>(a.start??-1)-(b.start??-1)||(a.end??-1)-(b.end??-1));
  report.applied.contexts.push(info);
 }

 const after=book.lines.map(line=>layout(book,line).text);
 if(after.some((text,i)=>text!==before[i]))throw new Error('Internal invariant failed: original sentence text changed');
 if(book.words.slice(0,initialWordCount).some((w,id)=>canonical(w)!==canonical(inputBook.words[id])))throw new Error('Internal invariant failed: existing word ID changed');
 const active=new Set(book.lines.flatMap(line=>line.t));
 report.activeWordIds=[...active].sort((a,b)=>a-b);
 report.inactiveWordIds=book.words.flatMap((_,id)=>active.has(id)?[]:[id]);
 report.ok=!report.issues.some(x=>x.severity==='error');
 report.stats={initialWords:initialWordCount,finalWords:book.words.length,appendedWords:book.words.length-initialWordCount,
  activeWords:active.size,inactiveWords:report.inactiveWordIds.length,repairsApplied:report.applied.repairs.length,
  glossaryVariantsUpdated:report.applied.glosses.length,contextsApplied:report.applied.contexts.length,
  errors:report.issues.filter(x=>x.severity==='error').length,warnings:report.issues.filter(x=>x.severity==='warning').length};
 return {book,report};
}
