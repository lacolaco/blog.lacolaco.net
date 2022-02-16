---
title: 'Notionテスト記事'
date: '2022-02-11T11:47:00.000Z'
updated_at: '2022-02-16T15:08:00.000Z'
tags:
  - 'test'
  - 'テスト'
draft: true
source: 'https://www.notion.so/Notion-80f5c54939b64e7ab25825bdb35f1cae'
---

この記事は Notion をヘッドレス CMS として利用してブログ記事を作成するシステムのテスト用記事です。

# Heading 1

## Heading 2

### Heading 3

lorem ipsum [link in paragraph](https://www.google.com) test

Multi-line **paragraph1**  
**_Multi-line_** ~~paragraph2~~  
`Multi-line` _**paragraph3**_

{{< figure src="/img/notion-test/7b83dc98-a03f-425c-a4a1-df0fe492714b/angular_(1).png" caption="" >}}

{{< figure src="/img/notion-test/193122c7-3622-4210-ad72-3ac7363e970c/angular_(1).png" caption="" >}}

- List item 1
- List item 2
  - List item 2-1
  - List item 2-2

1. Numbered List item 1
1. Numbered List item 2
   1. Numbered List item 2-1
   1. Numbered List item 2-2

---

> This is a quote. In quote **annotated text**.

```typescript
@Component({
  template: '<div>hello</div>',
})
export class Comp {}
```

{{< callout "👉">}}
This is callout.  
Multiline callout.
{{< /callout >}}

{{< embed "https://blog.lacolaco.net/2022/02/notion-headless-cms-1/" >}}

<pre hidden data-blocktype="toggle">
{
  "object": "block",
  "id": "f7ed6bf6-4174-4bd8-ab2d-554258eb7942",
  "created_time": "2022-02-13T16:04:00.000Z",
  "last_edited_time": "2022-02-14T15:46:00.000Z",
  "has_children": true,
  "archived": false,
  "type": "toggle",
  "toggle": {
    "text": [
      {
        "type": "text",
        "text": {
          "content": "This is a ",
          "link": null
        },
        "annotations": {
          "bold": false,
          "italic": false,
          "strikethrough": false,
          "underline": false,
          "code": false,
          "color": "default"
        },
        "plain_text": "This is a ",
        "href": null
      },
      {
        "type": "text",
        "text": {
          "content": "toggle summary",
          "link": null
        },
        "annotations": {
          "bold": true,
          "italic": false,
          "strikethrough": false,
          "underline": false,
          "code": false,
          "color": "default"
        },
        "plain_text": "toggle summary",
        "href": null
      }
    ]
  },
  "children": [
    {
      "object": "block",
      "id": "d890aada-773c-481c-a4dc-c4e6d234f779",
      "created_time": "2022-02-13T16:04:00.000Z",
      "last_edited_time": "2022-02-14T15:46:00.000Z",
      "has_children": false,
      "archived": false,
      "type": "paragraph",
      "paragraph": {
        "text": [
          {
            "type": "text",
            "text": {
              "content": "Here is the ",
              "link": null
            },
            "annotations": {
              "bold": false,
              "italic": false,
              "strikethrough": false,
              "underline": false,
              "code": false,
              "color": "default"
            },
            "plain_text": "Here is the ",
            "href": null
          },
          {
            "type": "text",
            "text": {
              "content": "inner toggle.",
              "link": null
            },
            "annotations": {
              "bold": false,
              "italic": true,
              "strikethrough": false,
              "underline": false,
              "code": false,
              "color": "default"
            },
            "plain_text": "inner toggle.",
            "href": null
          }
        ]
      }
    },
    {
      "object": "block",
      "id": "15371810-29e2-4596-a67f-2e564cfcee57",
      "created_time": "2022-02-14T15:46:00.000Z",
      "last_edited_time": "2022-02-14T15:46:00.000Z",
      "has_children": false,
      "archived": false,
      "type": "paragraph",
      "paragraph": {
        "text": [
          {
            "type": "text",
            "text": {
              "content": "Image in toggle ",
              "link": null
            },
            "annotations": {
              "bold": false,
              "italic": false,
              "strikethrough": false,
              "underline": false,
              "code": false,
              "color": "default"
            },
            "plain_text": "Image in toggle ",
            "href": null
          }
        ]
      }
    },
    {
      "object": "block",
      "id": "133bf0a6-576d-45fe-bf64-f759658391a7",
      "created_time": "2022-02-14T15:46:00.000Z",
      "last_edited_time": "2022-02-14T15:46:00.000Z",
      "has_children": false,
      "archived": false,
      "type": "image",
      "image": {
        "caption": [],
        "type": "external",
        "external": {
          "url": "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?ixlib=rb-1.2.1&q=85&fm=jpg&crop=entropy&cs=srgb"
        }
      }
    }
  ]
}
</pre>

<pre hidden data-blocktype="embed">
{
  "object": "block",
  "id": "90200a59-49bb-45d6-a9ac-f9f0e31e3f29",
  "created_time": "2022-02-13T16:06:00.000Z",
  "last_edited_time": "2022-02-13T16:06:00.000Z",
  "has_children": false,
  "archived": false,
  "type": "embed",
  "embed": {
    "caption": [],
    "url": "https://twitter.com/laco2net/status/1492833480694439940?s=20&t=d9u_aBlsmuSrdXTYPSHXkw"
  }
}
</pre>

<pre hidden data-blocktype="video">
{
  "object": "block",
  "id": "0d14cb05-3fab-4434-874e-68dd26741b96",
  "created_time": "2022-02-13T16:07:00.000Z",
  "last_edited_time": "2022-02-13T16:07:00.000Z",
  "has_children": false,
  "archived": false,
  "type": "video",
  "video": {
    "caption": [],
    "type": "external",
    "external": {
      "url": "https://www.youtube.com/watch?v=TmWIrBPE6Bc"
    }
  }
}
</pre>

$$
e=mc^2
$$

This is inline equation: $e=mc^2$

<pre hidden data-blocktype="table_of_contents">
{
  "object": "block",
  "id": "c3906a6f-cd9c-4985-934a-c55aa0420747",
  "created_time": "2022-02-13T16:08:00.000Z",
  "last_edited_time": "2022-02-13T16:08:00.000Z",
  "has_children": false,
  "archived": false,
  "type": "table_of_contents",
  "table_of_contents": {}
}
</pre>

<pre hidden data-blocktype="table">
{
  "object": "block",
  "id": "5b6d8f1d-26f2-4754-8cb3-a66aa3b95544",
  "created_time": "2022-02-13T16:11:00.000Z",
  "last_edited_time": "2022-02-13T16:11:00.000Z",
  "has_children": true,
  "archived": false,
  "type": "table",
  "table": {
    "table_width": 2,
    "has_column_header": false,
    "has_row_header": false
  },
  "children": [
    {
      "object": "block",
      "id": "b65cbedb-317e-48d5-bcdb-03551b833885",
      "created_time": "2022-02-13T16:11:00.000Z",
      "last_edited_time": "2022-02-13T16:11:00.000Z",
      "has_children": false,
      "archived": false,
      "type": "table_row",
      "table_row": {
        "cells": [
          [
            {
              "type": "text",
              "text": {
                "content": "0,0",
                "link": null
              },
              "annotations": {
                "bold": false,
                "italic": false,
                "strikethrough": false,
                "underline": false,
                "code": false,
                "color": "default"
              },
              "plain_text": "0,0",
              "href": null
            }
          ],
          [
            {
              "type": "text",
              "text": {
                "content": "0,1",
                "link": null
              },
              "annotations": {
                "bold": false,
                "italic": false,
                "strikethrough": false,
                "underline": false,
                "code": false,
                "color": "default"
              },
              "plain_text": "0,1",
              "href": null
            }
          ]
        ]
      }
    },
    {
      "object": "block",
      "id": "58ae5509-56c5-4615-9c94-d1ff86d31337",
      "created_time": "2022-02-13T16:11:00.000Z",
      "last_edited_time": "2022-02-13T16:11:00.000Z",
      "has_children": false,
      "archived": false,
      "type": "table_row",
      "table_row": {
        "cells": [
          [
            {
              "type": "text",
              "text": {
                "content": "1,0",
                "link": null
              },
              "annotations": {
                "bold": false,
                "italic": false,
                "strikethrough": false,
                "underline": false,
                "code": false,
                "color": "default"
              },
              "plain_text": "1,0",
              "href": null
            }
          ],
          [
            {
              "type": "text",
              "text": {
                "content": "1,1",
                "link": null
              },
              "annotations": {
                "bold": false,
                "italic": false,
                "strikethrough": false,
                "underline": false,
                "code": false,
                "color": "default"
              },
              "plain_text": "1,1",
              "href": null
            }
          ]
        ]
      }
    },
    {
      "object": "block",
      "id": "30464eb2-6360-410f-9b84-8e21d0f43237",
      "created_time": "2022-02-13T16:11:00.000Z",
      "last_edited_time": "2022-02-14T00:03:00.000Z",
      "has_children": false,
      "archived": false,
      "type": "table_row",
      "table_row": {
        "cells": [
          [
            {
              "type": "text",
              "text": {
                "content": "2,0",
                "link": null
              },
              "annotations": {
                "bold": false,
                "italic": false,
                "strikethrough": false,
                "underline": false,
                "code": false,
                "color": "default"
              },
              "plain_text": "2,0",
              "href": null
            }
          ],
          [
            {
              "type": "text",
              "text": {
                "content": "2,1",
                "link": null
              },
              "annotations": {
                "bold": false,
                "italic": false,
                "strikethrough": false,
                "underline": false,
                "code": false,
                "color": "default"
              },
              "plain_text": "2,1",
              "href": null
            }
          ]
        ]
      }
    }
  ]
}
</pre>

{{< embed "https://github.com/makenotion/notion-sdk-js" >}}
