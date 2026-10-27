const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
function validPassword(password){
  if(typeof password!=='string'||password.length<6||password.length>128)throw new Error('密码需为 6～128 个字符');
}
function validLock(lock){
  const base64=(v,size)=>typeof v==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(v)&&Buffer.from(v,'base64').toString('base64')===v&&(!size||Buffer.from(v,'base64').length===size);
  return lock&&lock.version===1&&lock.algorithm==='aes-256-gcm'&&lock.kdf==='scrypt-32768-8-1'&&base64(lock.salt,16)&&base64(lock.iv,12)&&base64(lock.tag,16)&&base64(lock.ciphertext)&&lock.ciphertext.length>0;
}
async function deriveKey(password,salt){validPassword(password);return scrypt(password,Buffer.from(salt,'base64'),32,{N:32768,r:8,p:1,maxmem:64*1024*1024});}
function encrypt(body,key,salt){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('shiguang-note-body-v1'));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(body),'utf8'),cipher.final()]);
  return {version:1,algorithm:'aes-256-gcm',kdf:'scrypt-32768-8-1',salt,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
}
function decrypt(lock,key){
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(lock.iv,'base64'));
  decipher.setAAD(Buffer.from('shiguang-note-body-v1'));decipher.setAuthTag(Buffer.from(lock.tag,'base64'));
  const body=JSON.parse(Buffer.concat([decipher.update(Buffer.from(lock.ciphertext,'base64')),decipher.final()]).toString('utf8'));
  if(typeof body.html!=='string'||typeof body.text!=='string')throw new Error('加密内容格式无效');
  return {html:body.html,text:body.text};
}
module.exports={validPassword,validLock,deriveKey,encrypt,decrypt};
