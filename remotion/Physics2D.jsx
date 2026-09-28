export const stepBody=(body,dt=.041666,world={gravity:980,drag:.08,restitution:.42,floor:1120})=>{
 const b={...body};b.vx=(b.vx||0)*(1-world.drag*dt);b.vy=((b.vy||0)+world.gravity*dt)*(1-world.drag*dt);
 b.x=(b.x||0)+b.vx*dt;b.y=(b.y||0)+b.vy*dt;
 if(b.y>(world.floor??1120)){b.y=world.floor;b.vy=-Math.abs(b.vy)*world.restitution;}
 return b;
};
export const simulateBody=(initial,frames,world)=>{
 let b={...initial};const rows=[];
 for(let i=0;i<=frames;i++){rows.push({...b});b=stepBody(b,1/24,world);}
 return rows;
};
export const springValue=(from,to,p,stiffness=170,damping=18)=>{
 const decay=Math.exp(-damping*p/18);return to+(from-to)*decay*Math.cos(Math.sqrt(stiffness)*p*.45);
};
export const collisionImpulse=(a,b,restitution=.45)=>{
 const nx=(b.x-a.x),ny=(b.y-a.y),d=Math.max(.001,Math.hypot(nx,ny)),ux=nx/d,uy=ny/d;
 const rvx=(b.vx||0)-(a.vx||0),rvy=(b.vy||0)-(a.vy||0),rel=rvx*ux+rvy*uy;
 if(rel>0)return [a,b];
 const j=-(1+restitution)*rel/2;
 return [{...a,vx:(a.vx||0)-j*ux,vy:(a.vy||0)-j*uy},{...b,vx:(b.vx||0)+j*ux,vy:(b.vy||0)+j*uy}];
};