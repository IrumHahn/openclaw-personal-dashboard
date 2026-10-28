// 나의 위젯: 격리 문서 만들기 (순수 함수 — 화면과 테스트가 같이 쓴다).
// CSP 로 외부 통신·외부 스크립트·외부 이미지를 막는다. 필요한 데이터는 앱이 postMessage 로 넣어 준다.
// 예외: 가상 오피스 키트(IrumHahn/openclaw-virtual-office)의 배경·캐릭터·엔진·음악은 jsDelivr(GitHub 미러)에서 읽는다. 그 외 외부는 여전히 막힌다.
// CSP 경로는 '/' 로 끝나야 접두사 일치가 된다(아니면 정확히 일치해야 해서 전부 막힌다).
export const WIDGET_CDN = 'https://cdn.jsdelivr.net/gh/IrumHahn/openclaw-virtual-office@main/'
export const WIDGET_CSP = `default-src 'none'; script-src 'unsafe-inline' ${WIDGET_CDN}; style-src 'unsafe-inline' ${WIDGET_CDN} https://fonts.googleapis.com; img-src data: ${WIDGET_CDN}; font-src data: https://fonts.gstatic.com; media-src data: ${WIDGET_CDN}; connect-src 'none'`

// CSP meta 를 문서 맨 앞쪽(<head> 바로 뒤)에 넣는다. 나중에 위젯이 meta 를 더 넣어도 CSP 는 겹쳐서(더 좁게) 적용될 뿐 풀리지 않는다.
export function widgetDocument(html) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${WIDGET_CSP}"><meta charset="utf-8">`
  const head = html.match(/<head[^>]*>/i)
  if (head) return html.replace(head[0], `${head[0]}${meta}`)
  const doctype = html.match(/^\s*<!doctype[^>]*>/i)
  if (doctype) return `${doctype[0]}<head>${meta}</head>${html.slice(doctype[0].length)}`
  return `<!doctype html><head>${meta}</head>${html}`
}
