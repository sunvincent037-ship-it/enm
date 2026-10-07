(function(root){
 'use strict';
 const clamp=n=>Math.max(-32768,Math.min(32767,n));
 function decodePsx(bytes,sampleRate){
  if(!sampleRate||bytes.length%16)throw new Error('invalid PS2 ADPCM frames');
  const coefs=[[0,0],[60/64,0],[115/64,-52/64],[98/64,-55/64],[122/64,-60/64]],pcm=new Float32Array(bytes.length/16*28);
  let h1=0,h2=0,out=0;
  for(let p=0;p<bytes.length;p+=16){let filter=bytes[p]>>4,shift=bytes[p]&15;const flag=bytes[p+1];if(filter>4)filter=0;if(shift>12)shift=9;const [a,b]=coefs[filter];
   for(let i=0;i<28;i++){let sample=0;if(flag<7){let n=(bytes[p+2+(i>>1)]>>(i%2?4:0))&15;if(n>7)n-=16;const history=Math.trunc(Math.fround(Math.fround(a*h1)+Math.fround(b*h2))*256);sample=((n<<(20-shift))+history)>>8;}pcm[out++]=clamp(sample)/32768;h2=h1;h1=sample;}
  }
  return {sampleRate,channels:[pcm]};
 }
 function decodeAdx(bytes){
  if(bytes.length<20)throw new Error('truncated ADX header');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),start=v.getUint16(2)+4,frameSize=bytes[5],channels=bytes[7],sampleRate=v.getUint32(8),samples=v.getUint32(12),cutoff=v.getUint16(16);
  if(v.getUint16(0)!==0x8000||bytes[4]!==3||bytes[6]!==4||frameSize!==18||channels<1||channels>2||!sampleRate||samples>sampleRate*600||![3,4].includes(bytes[18])||bytes[19]!==0)throw new Error('unsupported ADX format');
  if(start+Math.ceil(samples/32)*frameSize*channels>bytes.length)throw new Error('truncated ADX frames');
  // CRI's coefficients use single-precision arithmetic.
  const f=Math.fround,z=f(Math.cos(2*Math.PI*cutoff/sampleRate)),a=f(f(Math.SQRT2)-z),b=f(Math.SQRT2-1),c=f(f(a-f(Math.sqrt(f(f(a+b)*f(a-b)))))/b),coef1=Math.trunc(f(c*8192)),coef2=Math.trunc(f(f(c*c)*-4096));
  const pcm=Array.from({length:channels},()=>new Float32Array(samples)),hist=Array.from({length:channels},()=>[0,0]);
  let pos=start;
  for(let frame=0;frame<Math.ceil(samples/32);frame++)for(let ch=0;ch<channels;ch++){const scale=v.getUint16(pos)+1,[h]=hist[ch];let h1=h,h2=hist[ch][1];
   for(let i=0;i<32&&frame*32+i<samples;i++){let n=(bytes[pos+2+(i>>1)]>>(i%2?0:4))&15;if(n>7)n-=16;const prediction=Math.floor((coef1*h1+coef2*h2)/4096),sample=clamp(n*scale+prediction);pcm[ch][frame*32+i]=sample/32768;h2=h1;h1=sample;}
   hist[ch]=[h1,h2];pos+=frameSize;
  }
  return {sampleRate,channels:pcm};
 }
 const api={decodePsx,decodeAdx};const DV=root.DV=root.DV||{};DV.bt3Codecs=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
