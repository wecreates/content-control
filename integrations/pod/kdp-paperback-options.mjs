// Black-ink paperback rows from KDP G201857950, checked 2026-10-20.
// Source: https://kdp.amazon.com/en_US/help/topic/G201857950
// US/JP select the separately published target-market tables. This is a
// versioned necessary check, not an official calculator template or approval.
const regular=Object.freeze([828,776,812]); // white, cream, groundwood
const square=Object.freeze([800,750,784]);
const a4=Object.freeze([780,730,764]);
const large=Object.freeze([590,550,578]);
const table=(ordinary,special)=>new Map([
 ...ordinary.map(size=>[size.join('x'),regular]),
 ...special.map(([size,limits])=>[size.join('x'),limits]),
]);
const us=table([[5,8],[5.06,7.81],[5.25,8],[5.5,8.5],[6,9],[6.14,9.21],
 [6.69,9.61],[7,10],[7.44,9.69],[7.5,9.25],[8,10]],[
 [[8.25,6],square],[[8.25,8.25],square],[[8.27,11.69],a4],
 [[8.5,8.5],large],[[8.5,11],large],
]);
const jp=table([[4.06,7.17],[4.13,6.81],[4.41,6.85],[5,7.4],[5.04,7.17],
 [5.83,8.27],[5.98,8.58],[5.98,8.94],[7.17,10.12],[7.17,8.11]],[
 [[8.27,10.12],a4],[[8.27,11.69],a4],
]);

export function requireKdpPaperbackOptions(template,country){
 const paper=template?.paper_type,index=paper==='white'?0:paper==='cream'?1:paper==='groundwood'?2:-1;
 const trim=template?.trim_inches;
 const key=Array.isArray(trim)&&trim.length===2&&trim.every(n=>typeof n==='number'&&Number.isFinite(n))
  ? trim.join('x') : null;
 const limits=(country==='US'?us:country==='JP'?jp:null)?.get(key);
 if(template?.ink_type!=='black'||index<0||!limits)throw Error('KDP_PRINT_OPTIONS_UNSUPPORTED');
 if(!Number.isInteger(template.page_count)||template.page_count<24||template.page_count>limits[index])
  throw Error('KDP_PRINT_PAGE_LIMIT');
}
