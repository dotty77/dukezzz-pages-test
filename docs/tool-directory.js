/* The directory uses the same relative destinations on the main site and on Pages. */
(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const actions = header?.querySelector('.site-header-actions, .header-actions');
  if (!actions || typeof window.HTMLDialogElement?.prototype.showModal !== 'function') return;

  const groups = [
    {
      title: ['角色与配装', 'Agents & builds'],
      cover: 'assets/tuning/agent-1561.webp',
      links: [
        ['agents.html', '代理人资料', 'Agent directory'],
        ['showcase.html', '角色练度', 'Agent builds'],
        ['disc-planner.html', '驱动盘规划', 'Drive Disc planner'],
        ['team.html', '配队与合轴', 'Teams & rotations'],
        ['materials.html', '养成计算', 'Material planner']
      ]
    },
    {
      title: ['调频与资源', 'Signals & resources'],
      cover: 'data:image/webp;base64,UklGRiQXAABXRUJQVlA4WAoAAAAQAAAAVwAAVwAAQUxQSFMEAAAB8IRtt2nbtm39KaU8bNu2bdu2bdu2bU3btm17ztiwx2g55fQHWkWpJednhiNiAtBTUUvJVACIWkqmgvrFkqJLS1qVmAHATCvveMYtH/7Sd378859858sfvvWMHVZIACRJLWoAZt74wo//432O++6fnz9xBQCmNZgBs+326N85vXjO7qUU95y9kOS73zxtMcC0byrAqjf9nWRkL8Fxo2Qn+erj6wEmfVIDtv7Ie2TJhZ2HO5lfWBXQ/hiw6edIeuGEw8m3rpkJqScqWO5ZMjzYw3Dy5+vBpA8JOPsVhrOvkfnOiVCZmBhW/hqZ2Wcn74LIhERw6GvMwX5H5rMmMhGF3EE6+z/FD4jJBAxzfJoerHGKDyN1p1jwh8ysdIrnwbpSLPgLZtYauWwN60Zl7p8ws97Cf86l0oVY+ioza858ANZFwiOcYtXhvo7YeAknc4qVOz8LHcuw5rsetUUp60LHSj+ls/rMJ2FjGM5jZv3BVxaAjKSy+OslGkDn4ZZGMjxMZwtzPA+VEVSWe7dEE4Iv7psgwwx3M7OZX59DZZBg/pcjWhHv81KkQQkn0NnMUn6XZJDiK9GQ4DvLQqcJFnuD0Q4W7gibZtiPhQ11Hj4o4U7mtpyCNE3wbXpbzh4gmOVfLG05Z4BiyTcZbTlzyBpsq/OEAYZ1GY05GDZgvcYU7jJk3cZEWRsKQLEmmxp8bdEhS73FaEjh32aEABDM+h+Whnj5HBTTBT9tSuYFSAMMzzC3I/jjeUUGJJzZksItYRio2DCiHc5DZIhgpr+yNOQUpEFIuI+5GZmnjWDYkKUZzpNHgMr3w9txAGyYYR82o3DrUaD6E5Y2BH1l6AiGreltKPzf7JARYHiCuQnOr0Ixqujc/6S3IPN6pJFg2GwqogHBbWCjwXBs9voK/zMrZAwYvk2vLvMBGMZNegdzdREbdoH96LV5fBuKsRULv86orHA32HhQfCa8Luf3RdFhwoGsbktYFyKz/StKTc5nYeg04Tx6RYW/nzl1JDLHf6JUFD/bFLBOYDiCuR4G+eDc0E5g+BK9Hpbgn7aEdqKy5ItR6iEz399WrAsYtqdHRXyfT6EbJJxCj4pyXIXUDRIupUc9hdvDOkLCRYxSS/DVBSBdieHEKeZKnN8XQfcJW/6TXqrIvBVpAjAs8BzppQLnPrBJwIC9f0t6mUSUnAsZOZcYFnx7cehEIIqZT/sLyVyik/DMkXMZVPhjEUzagFmO/g5JevYSwyKK50Iyfv3QyTtstNF2x9/9k0J6TMu8G2liEAOw/vU/f58Do7h7CQ5845vnr6kYvuaN/yWdZOHefQDEAGCFw+/+5j/e4tDy0u8/cf3eSwCAJVO1ZADmvuBFOoNvLQ7tAwBNmD7LkmtutdshRx6w06YrLygAIEkFwzUBS36K7vwhBL0VTaYYXZMpxpUE3MJ3y41I/RkoqmaWzExF0K0a7iY3gvWsl2K45ykR/F+tOgoAVlA4IKoSAACwRACdASpYAFgAPh0KhEGhBseFuQQAcS2AGUaSd+L1z+AehFTf6P+F/WT0d8yeT55P+x/8PpCfm3/re4B+pf+j/Mr4w/7L9bvc5/R/9V6gP1l/4n+y93D/c/sd7mP7j6gH8//u//v9qr1BP3A9gD9gPVq/4P7qfA//XP9P+4HwG/r5/2Pz/+QD0AOEa/nP4Ad/n9C/HP9wPVn8S+Q/qf5Gf2z/vf6L4HMdfOF/Deh/8S+yv33+rftl/av3A+Lv8b4M++/+W9QL8R/j/9x/Jb+0/tx6xnag6N/j/9F6gXqD81/wf9w/b7+5ftd7IGod37/13uAfyT+af4z8pv3/+o/9z4EXg30AfYB/Kf6P/kf73+5v+l+k/+D/4/+I/dD/Vezv82/sH+2/yn+U/9f+D+wT+P/zf/Jf2f/Gf9H/Ff/3/rfd369P2C/+3ucfqi7MsOS5wk025oANMtt6KdbZSkurhT94Y3jGNG7/FnamRWcFYz+urvjgsO/9n/6us3VMDUrnkR8VMi0Ry2HK5gib63wLJ2YhNwoRF/oBqfElQm4W1YSlX+mxOCgQpABrmLQyE/Ul0IGJczR/PxSfVJiGuwU4Jmht3lU0WoJxqg8kWSRdTIJ98PCIkCGNryADF8cEjPaySmZwrJdnR6E+2rTfGQE1WBPXrWeZ7scKpqlzVmtFIDrLZfxByL9XC+ST1QjyNdc91ZuVgLvMbLbl8+RqJYnAMba206z74hST+cwu6uAA/v6FCaP/mYC6JDdMSrpi/yfA0qAj9qP/0+lAbvSUAdpxmCjOSErmrYrGFXdggzk72W9KN2q6yCcR2iG4awvTZz6gtIA7nnolh+OkSXDJ3MffgoXbiLLOaCnvhokCN3wrSoJbeRsXYAuGaj7w92/N5pNFZSF0Pz6taFjVkpKtoujl6XqCqtK0WwHAjKGzgDXxFuLUOKBl/ieL9x9MD2/1O2H4sHuhd+S2Yvo+X8X+I0FeN0RR0ix9sdv9ZfUo+1XbLz1TA1G6WlZJtkGG8CsclBTnPb87jvhrcss7H3e1mi66Of+p5Rsaz9BLkQZQgKsyzpK5DiceXNvpZ1CMrvtW5ncf1uqhhQeJ6CxRYktl0XMpZwk36UTCeX+STG17jPyx6Mgm2fTDrJ7rHGetlo2X/F1ENlyC4kKkP05OuzMgJCsZt73PNS6p/dCKa0OgwFTiVGEqdLGa+qDMyf0A6w+RCUbkEb6vRs4pLOGZxOeTQPuW6Z5xowlXuPW3fSu1Wb2QKMNtN9BOwo4qKx6iR6spfYwClHNrxyk5WYGLQkL0szpTGchgw1mfYhCFymY2BsxIe9fCcAwFPPJ9HNYiOYHDL7jfs7/ol6GmIo247rIhO5fmhvhk9zDXpcKFjTBToNROR/q8eRwSjvKrEZ6nrCfsAV2lX6svNRyFvT5PV3pwt9HFU1fqo77RszdtcDfNgC8h0MWQ4dZRd4Ov6ODTKDVyx7laGeE56lPmqeBZX/xNY2/o1vy+hKJvr7gVd26/+Yjyn/4uJHtdqCqFHtbLL/JxtN5qoBWCNCCRwF9g6a3na6fAF+3a7Nqo3vIgK4NwDelAQ670tdBq1c0WY+rLkAQA5tE5Z8DU4UmjD992pVVTwVYVf+q7GHvMHsC4WKkGElhP9VLdbGbirhuJcVHeWfRPuiJARI+Qg2FeJ0M4FBG3/bc5nyf3HGOddyz/RTNuZQoEOVlQza/Ors+rIxk6Hk4aE21SpcB2JleveoXqOzcIjD4cMscgCsI6zvJCm8kkk2MK8yclY6qQkESHvFK5MSFTN0bXrnldMxLoa8KZxRXTPazAzxUvLvzTU9wUcBc28sF8xF0uHnpPZ9C9lRPffeWRsp9fvuOnNAbEgg9JQBzadmJWliZ+U3xBp8/iI5jH/PWZxadHZesr06aH9A3VZ44KoVNFq1BivH8yNd4hmiOLetmszPmmuVg/9E8uXfkSiP3sGFVvrBwiJJcEFRJidyeldoToNnsP+ZLbi07dOnpl4/0EPw528ZtqMd+H1IrBJ4I0nG7NFLr7zR6wjxtDDkP0N+At8/1a/b7ljMo4wssBpxA/4sTakFe7vWIn9AkXWy3NE/F+r4w+q/4xJ7+bjTA/5J56qxOQQkAbV7grlJXCbMIkDpadadJ4LqBLN4pbJyI8mvWMnmsose0mxN9K2YGmwsARONHjBFab0vl7RW+RcthxGimCauZiVTyCGh0xv1gADV8cmI/JPVQ3CR08+kfxhxfMG9Z1wiAhJbNHHi60Nc/ahio8OFH8WtjAT/uU+/X9uog8AAubiKxMNyiZr3wDEPc30KdZ937NO2t/aHfO8imD9+15/1K7qYhhcAO+f+Ggof9fS4pDDEFMhaMSC9w2m+S3hzFz4EZ/mFX4yC3R/2SnUxmGceU/j/sUfS/7UQ4kUGPw7ke+EXGMokPpNeonhEu34VDx4HfPrIggrR40XxW1SKIhU2Bjz4SCY8gNvwW6NAUnqXzmnFf89gUgHwMY74YfMPzfg7prcuCOZeULR9H/WF6O9QmLwHlKU8Ri12mMybmtjSbLCnFN/Vl1yvne59xTktwbSkLrPaDdnCnVJ6g0HsxC/T/oros8xbvY3rJMOFCmLv5hCpOqG7UZBJPhTqVQkJZgfHsAbW21GH18RXgvBvMkGRDE9D4j02IlNYLat/97D2aS1usKYf+TD4UkyrZdS8bzdWZi3GyCeV1DRGQIdyAb8ridXQxViL+UYUo3HtYddJkkcowrGo/hg4NTl+eWHi7qVOhuRs2BLoGkGPdsxQkECZLDTW7tL06dt4P5VgKkttCp+tnufhNL+OsrKvyTctmJMlKgAvhty+nHSmy2ByGNRUFg/wKx8Uf/K6pOIz9eif86vyg1ZvSm+Dj/VxOBWjEeWVGn/65bkWIzUldd9RN2Pv1foAIBskj1d4GdCJSo1JW1KpwAizdVJdtHoSXS7kYKwfwA271w4dWvcYM7f932A6LtAfV7n6fNzmBXmwPI9IB4//FubXm9VH/l+VazWJr8h07j17DBGv38fPwaltC1xaibg5b2udwdtOyjW/sJmXJyPxH9ctnGY694ggjT7hXTnJmEbzqg7MZssI1rar/XdWwI0PUwkgJ2vVjPqfW4aZUiOwN1zDnn6FgxixJnhwV4WX2KjmmE4VZhTDJSJxArNNW22H9Fs1TRlr0KTLaAEtviiIdChXed6RQOoVGAKEx/S7ucV0qdy9JpisoFAlZ13HfgtfpMid54NKu3/BPGU348OaVtyLoayi5/MHyLzTkFk/El3MOg3OhniqS5JIPtqFswwlkp7dpApV/bCWsX/Fn/YZpXyTiL2UY+NZfhW3Z4klrCqiOIQ3WMnTgnmVfQ3ifJqFTeP4bH3iTzIJ8f6Fqdm/GZu66UAiS75WZP1/6cosbXkgFF01ER9hE6mCy9ikdNhPAq8dGXByiZP7GThSMK2pJaq5WiSIVJ0OgO7XqcJj+k8P83yTAPUHvHLe8wnhiELCUebzRsYn9jZlpZqowzWXQcLLlv6bh8qTjh0OxUPyAs2I7A6OzDyF2HlrKPpp7qo0DEPofz/zFwOZo33zS7PeFd2lpw5XKfJpHAYmhHerdoL8muIFoY++fGcxgWX9LBOTY0R55bwAHssn7Tli9WtbQNADKisopS/n89eDq5498tH3LYiNJNS9Mq+x3/lC/zdl9n5mmK+YYkfnUOZCoJ/7V34QMX7aB3U8bDoo12f+qSKUjC7cxToTs9pJKfNG9oGtaj3uuZ7bv7GqTDfEdCdBy5/HIAJzOApplHKnXUvGjowvTFG+vUvu/7dCNuNj1aJYyCeJB907WfMOX9kZKI4pdL34C6+yupR8Fuw5DHbK8rhDAFgqWMEMh7rGB9yRln7jP45IWM/6Fm6WqZTPkBsTxay6JzKO3GgtOPn9aDOmstgca1UsmcYwaDi5piC8LoqnUy2EBQ8Q5FUHu2YowIbXRD2qpCGhlEo2msnbc5Tj4RxuhozdGTkm+I6mF9M6bh4AFK0kDAsDUv7C0wRXgt5vXoZwK7ULaCIS4VXzrbNfDqTqz+KvXvvSUMOdp5wuoGr4EVP+J7YS0BoXqLiLtCB928FdD626iYqMwIXKJ/RB/kXYnlecY2m4fn29vuuHYr996+dzN3yV7u43b54qWkLgj88FIhJ+hLWwm2aXkOAZ0cVZyORik9NAQNplbj524qDdMeLFWFHLkT3sk+4674bZfBvbPdDdRm0XNvk5W24RmTWWKDPxnwUM8uZ6ciXYZ5T/nBbmzbJ/E1fFapzgMvQ6quRPxz+Ws9YgxyTZDVdvQA7cBIW1Gkq3jZd42T4jl4LdnOeCOk7am54ee1rQNaSSoS4oghFHUb0MXzwR+qUg9Wpg9xv+MjxjPO8ILVoVdEBtGmfO7OWbycHJ4jMsXNjz/vaeskfhRgT+lvM7Z8ERNwV7+12DD6l0696zAi2s34WNDE8GQFpXSJvWBc3DG1mhC9NsTYopEc0qINC5hiYKpD4aSvJmC9gIobSGw087N6HqhnlRgm+H2Tx5wwMItKdBOCPTM20l4+ZgEMDNS3vOfSzZHtqkAic4p8CembJHvS9hFFCFclDIhyB7WI3+Hepl4i19LOes8PndomGIQCYfeIMCBwoNu3RLY4ikZW3/wIYKJAFccx9MjgKV3nVGTXF2ej7wFBXH2jIzGHBPzHsIw4zKzk9+tbQyL/TxFDp+MQ6vgDomOWeMZBrwexdUeO8sBDm5mOBFM9C3t1jqIYel8WBZOtJcUmnE+PiEx0n58vXj+fXrxMGsO9gQUQecGO+pL/xvdtdAdwh2LkNqcZTFKYJJtOv/CtbKvMyf5oxPg5wOvpcAc9p1NuPG2GQtA/ChQ80zY6/cuWCaE1lkO2nKnugdoa9bKISqdB4HbYefPKEHkyLDg14V0lDWl+DjvIzuXRfuesHKekKpQjkqjvOLsMADidZ/JwMUHrIDCYCWOhC0Q7RXuTfk16bq3uNuMV05ykH8Dpq8zqHIQ3aPzLLk8SSza6WIYkXEcMoicvvkwEdHnbiJcNDYVAcMAboY8gMD+AQGnqOep/+wzNzr+sjbHjzXRAR5+z6EyNhGX7QQTlApzrez7zH4CVj5cgI1SEnXz7EJT/ZVmCpQpZTzyaG0Zgw0Ikv9QDMs1sXPYApjnZlKd/mgdvdnPWRZqfmf2NFdMHP1+MTs9XcLrdv0+sQC4OkA/vpvYeMgnFLuSi0JIFzYepgiT2zExFFE/QQCXVkjVZSoAA8HRp9KdlaGv0ndQb17DkYHmEzPMWvpw92fS+Yn+r507tLzqJ4DXy4kHRKsx9AsfmyuCbM2pQ9qjFm7WbgxZixl97YUA6s46DEwyo4E6MbqTnvbENcM5Ovh3iCFQI/Eruro0oXqHjtG5IJCBTN5IRWBW1VdOsQHP3GhYfEDX7S8Aw6PE+trCdxPEMr3HDcgzAdC/993/UWdDpdUlQUnfTBpu6+CWea+Y6eVkJl43dCsiEz8Ek6PTE5L1Sj/2e6HhqaBbhnImY63mkwe5EdfCGq9Bmn8a3CSPYOIf8J30a66CVDEiDxO88j+3rJoNtCFYcM/iW3Qerw9o5yfzSMnLZrQeOwgiPV+1t7Wl0y8pSP0xXyJ6U3VymIsNif0f/bzetof3d5kgLrMJNTg7vJkc4rkp+La88tDuiSfelhupHtSXxYgpL1XpnTmr96P4zVXjQ2I807rYWiDuX5Rn3HciWXRr5UmatnoeOwbNKtywBZZ6ebGurHCjrfq95QBE3bL0MfpPyNWv9ugPJ3aREwX5zDg+k2QaXf96r9ZdZ7mkjSzqKa6I+z/BH0SeHRr2CeVOXeTfqeRJrqS3StZy7ixI2dIeYUmczzEvmxwH3kjovVBJyQUh6Lnv6tQIovcs5aFkJ7WePf8DV8N8cxXIcruG/1/3xSO5GZZg2Uks3HpsFlhBuylHDNYQJ5s6NsDeFEc11GT+qPo/Et6n5/C9qgMIh5hq3uN0kYvhWjaAVWeFJ76Ix9a2TngZRUgA9sC2o7wK0SgyRaqQ0rmgqdi3Jun+HkvN0avQRd7sC0bVyGxqclYZfgwe0X/kAYBbNf+XDONN8HKyLeFJHWFtWgtsU38AzchoJl6kB/rFu3xnqJ+QsTt42ppAR4PZkA/v1Y6BPxau4Akuvk+dLFqCpNxQImw/tLCnriaxnS9roKxdLjTRG4MMXQ8ACUElt1VgySEKVnK+o266EEF6UOm0FjgwvQPbt0e4sJDS3XCos/KKIhg+mce+jVdAatRaq8t2ifPEUN4KcFfFJz552yp8rusBy8RMUsZ74N4cohTnpT39nMNRhvIjgGgdxhbROjEKJS/Mla/ul/3//bdmet28XjUk9vhluG8GAAAYgDHTZpau+IAAAAA==',
      links: [
        ['tuning.html', '调频记录', 'Signal Search records'],
        ['tuning.html#target-expectation', '抽卡期望', 'Expected pulls'],
        ['banners.html', '卡池日历', 'Signal calendar'],
        ['oracle.html', '绳匠灵签', 'Proxy fortune']
      ]
    },
    {
      title: ['探索与图鉴', 'Maps & collections'],
      cover: 'assets/items/webp/870d0447d9cb1730a954d1af.webp',
      links: [
        ['index.html', '探索地图', 'Exploration map'],
        ['janus-3d.html', '雅努斯 3D 地图', 'Janus 3D map'],
        ['suburbs-3d.html', '城郊 3D 地图', 'Suburbs 3D map'],
        ['gallery.html', '物资图鉴', 'Item collection'],
        ['tv-wall.html', '电视墙', 'TV wall']
      ]
    }
  ];
  const english = () => (window.DUKE_I18N?.language || document.documentElement.lang).startsWith('en');
  function element(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }
  const trigger = element('button', 'tool-directory-trigger');
  trigger.type = 'button';
  trigger.dataset.i18nSkip = '';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'duke-tool-directory');
  const gridIcon = element('span', 'tool-directory-icon');
  gridIcon.setAttribute('aria-hidden', 'true');
  const triggerLabel = element('span');
  trigger.append(gridIcon, triggerLabel);
  actions.prepend(trigger);

  const dialog = element('dialog', 'tool-directory');
  dialog.dataset.i18nSkip = '';
  dialog.id = 'duke-tool-directory';
  dialog.setAttribute('aria-labelledby', 'tool-directory-title');
  const bar = element('div', 'tool-directory-bar');
  const title = element('h2');
  title.id = 'tool-directory-title';
  const close = element('button', 'tool-directory-close');
  close.type = 'button';
  close.autofocus = true;
  close.textContent = '×';
  bar.append(title, close);
  const nav = element('nav', 'tool-directory-groups');
  nav.setAttribute('aria-labelledby', title.id);
  dialog.append(bar, nav);
  document.body.append(dialog);

  function setLanguage() {
    const label = english() ? 'All tools' : '全部工具';
    triggerLabel.textContent = label;
    trigger.setAttribute('aria-label', label);
    trigger.title = label;
    title.textContent = label;
    close.setAttribute('aria-label', english() ? 'Close tool directory' : '关闭工具导航');
  }

  function populate() {
    const locale = english() ? 1 : 0;
    const here = new URL(location.href);
    const page = here.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
    const sectionHash = page === 'tuning' && here.hash === '#target-expectation' ? here.hash : '';
    const fragment = document.createDocumentFragment();
    for (const group of groups) {
      const section = element('section', 'tool-directory-group');
      const heading = element('h3');
      heading.append(group.title[locale]);
      const cover = element('img');
      cover.src = group.cover;
      cover.alt = '';
      cover.decoding = 'async';
      heading.append(cover);
      const list = element('ul');
      for (const [path, zh, en] of group.links) {
        const link = element('a');
        const destination = new URL(path, document.baseURI);
        if (locale || here.searchParams.has('lang')) destination.searchParams.set('lang', locale ? 'en' : 'zh-CN');
        link.href = destination.href;
        link.textContent = locale ? en : zh;
        if (path.split('.')[0] === page && destination.hash === sectionHash) {
          link.setAttribute('aria-current', 'page');
        }
        const item = element('li');
        item.append(link);
        list.append(item);
      }
      section.append(heading, list);
      fragment.append(section);
    }
    nav.replaceChildren(fragment);
  }

  setLanguage();
  document.documentElement.classList.add('has-tool-directory');
  function revealCurrentTab() {
    const switcher = document.querySelector('.agent-page-switch');
    const active = switcher?.querySelector('[aria-current="page"]');
    if (!active || switcher.scrollWidth <= switcher.clientWidth) return;
    const item = active.getBoundingClientRect(), strip = switcher.getBoundingClientRect();
    if (item.right > strip.right) switcher.scrollLeft += item.right - strip.right + 4;
    else if (item.left < strip.left) switcher.scrollLeft += item.left - strip.left - 4;
  }
  requestAnimationFrame(revealCurrentTab);
  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    populate();
    dialog.showModal();
    document.documentElement.classList.add('tool-directory-open');
  });
  close.addEventListener('click', () => dialog.close());
  let focusAfterClose = trigger;
  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (link.pathname !== location.pathname || link.search !== location.search) return;
    const target = link.hash && document.getElementById(link.hash.slice(1));
    if (target) {
      target.tabIndex = -1;
      focusAfterClose = target;
    }
    dialog.close();
  });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('tool-directory-open');
    focusAfterClose.focus({preventScroll: true});
    focusAfterClose = trigger;
  });
  window.addEventListener('dukelanguagechange', () => {
    setLanguage();
    requestAnimationFrame(revealCurrentTab);
    if (dialog.open) populate();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && dialog.open) dialog.close();
  });
})();
