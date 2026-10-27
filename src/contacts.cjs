// Fixed destinations only; note content cannot supply an arbitrary external URL.
const contacts = Object.freeze({
  author: {label:'联系作者', url:'https://v.douyin.com/0gmTrkNdDHo/'},
  feedback: {label:'使用反馈 / 功能建议', url:'https://laobaiai.com'}
});
function contactUrl(key) {
  if(typeof key!=='string'||!Object.hasOwn(contacts,key))throw new Error('不支持的联系入口');
  return contacts[key].url;
}
module.exports={contacts,contactUrl};
