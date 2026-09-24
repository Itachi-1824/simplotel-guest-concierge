import {createElement as h,memo} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components={
  a:({href,children})=>h('a',{href,target:'_blank',rel:'noopener noreferrer'},children),
  table:({children})=>h('div',{className:'chat-table',role:'region','aria-label':'Comparison table',tabIndex:0},h('table',null,children))
};
function MessageMarkdown({text}){
  return h('div',{className:'chat-markdown'},h(Markdown,{remarkPlugins:[remarkGfm],skipHtml:true,disallowedElements:['img'],components},text));
}
export default memo(MessageMarkdown);
