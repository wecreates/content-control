// Exact signed evidence timestamps shared by market, finance and templates.
export function validEvidenceTime(value,now=Date.now()){
 if(typeof value!=='string')return false;
 // Require an explicit zone and at most PostgreSQL's six fractional digits.
 // Reject normalized invalid calendar dates and 24:00 rather than changing them.
 const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
 if(!match||!Number.isFinite(Date.parse(value))||Date.parse(value)>now)return false;
 const local=Date.parse(match[1]+'Z');
 return Number.isFinite(local)&&new Date(local).toISOString().slice(0,19)===match[1];
}
