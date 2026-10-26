// 나의 위젯: 격리 문서 만들기 (순수 함수 — 화면과 테스트가 같이 쓴다).
// CSP 로 외부 통신·외부 스크립트·외부 이미지를 막는다. 필요한 데이터는 앱이 postMessage 로 넣어 준다.
export const WIDGET_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:"

// CSP meta 를 문서 맨 앞쪽(<head> 바로 뒤)에 넣는다. 나중에 위젯이 meta 를 더 넣어도 CSP 는 겹쳐서(더 좁게) 적용될 뿐 풀리지 않는다.
export function widgetDocument(html) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${WIDGET_CSP}"><meta charset="utf-8">`
  const head = html.match(/<head[^>]*>/i)
  if (head) return html.replace(head[0], `${head[0]}${meta}`)
  const doctype = html.match(/^\s*<!doctype[^>]*>/i)
  if (doctype) return `${doctype[0]}<head>${meta}</head>${html.slice(doctype[0].length)}`
  return `<!doctype html><head>${meta}</head>${html}`
}
