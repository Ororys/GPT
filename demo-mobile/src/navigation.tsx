import type {AnchorHTMLAttributes,MouseEvent} from 'react';
export function navigate(path:string){history.pushState(null,'',path);dispatchEvent(new PopStateEvent('popstate'));scrollTo({top:0,behavior:'instant'});}
export function useRouter(){return {push:navigate};}
export default function Link({href='',onClick,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){
 function click(event:MouseEvent<HTMLAnchorElement>){onClick?.(event);if(!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&href.startsWith('/')&&!props.target){event.preventDefault();navigate(href);}}
 return <a {...props} href={href} onClick={click}/>;
}
