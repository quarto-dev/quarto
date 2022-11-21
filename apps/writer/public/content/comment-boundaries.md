This <!--#a[a1:"Joe Cheng" at 2020-03-04T13:06:07.000Z] Comment a-->comment is entirely internal<!--/#a--> to the block

<!--#b[b1:"jcheng" at 2020-03-04T13:06:07.000Z] Comment b-->This comment starts at the beginning<!--/#b--> of the block

This <!--#c[c1:"jcheng" at 2020-03-04T13:06:07.000Z] Comment c-->comment ends at the end of the block<!--/#c-->

------------------------------------------------------------------------

Comments can also <!--#d[d1:"jcheng" at 2020-03-04T13:06:07.000Z] Comment d-->span paragraphs.

Like this one<!--/#d-->, for example.

------------------------------------------------------------------------

This comment starts (invisibly) at the very end of this paragraph...<!--#e[e1:"jcheng" at 2020-03-04T13:06:07.000Z] Comment e-->

...and continues<!--/#e--> into this paragraph.

------------------------------------------------------------------------

This comment starts <!--#f[f1:"jcheng" at 2020-03-04T13:06:07.000Z] Comment f-->inside this paragraph...

<!--/#f-->...and ends (invisibly) at the very start of this paragraph.

------------------------------------------------------------------------

This <!--#IygI5JmP[oB3KjbAr:"jcheng" at 2020-04-23T17:26:45.123Z] Comment g-->comment <!--#WQva74AT[dZWDymOw:"jcheng" at 2020-04-23T17:26:54.916Z] Comment h-->includes<!--/#IygI5JmP--> intersecting<!--/#WQva74AT--> comments.

No comment in this paragraph.

Also no comment in this paragraph.

------------------------------------------------------------------------

Comments in lists have additional complications.

-   This <!--#dQJstr26[a1:"Joe Cheng" at 2020-03-04T13:06:07.000Z] Comment i-->comment is entirely internal<!--/#dQJstr26--> to the block
-   <!--#gOXXCB6r[b1:"jcheng" at 2020-03-04T13:06:07.000Z] Comment j-->This comment starts at the beginning<!--/#gOXXCB6r--> of the block
-   This <!--#AZmKOt39[c1:"jcheng" at 2020-03-04T13:06:07.000Z] Comment k-->comment ends at the end of the block<!--/#AZmKOt39-->

------------------------------------------------------------------------

## Actions to test

("partial comment" means a range including a comment's beginning OR ending node, not both)

1.  Delete a partial comment. *Expected: the other part will be left in place, but truncated.*
2.  Copy and paste a partial comment. *Expected: the newly pasted content will not be a comment.*
3.  Copy a partial comment, and paste it in the interior of the original comment. *Expected: the original comment grows.*
4.  Drag and drop a partial comment. *Expected: the dropped part is no longer a comment, but the other part remains a comment.*
5.  Copy and paste a selection that includes both the beginning and end of one or more comments. *Expected: the newly pasted content will introduce a forked copy of the existing comment thread.*
6.  Drag and drop a selection that includes a whole comment. *Expected: the comment moves and doesn't change threadId (see ProseMirror devtools' Structure tab).*
7.  In the comment thread UI, delete the last comment in a thread. *Expected: The comment highlighting disappears from the corresponding part of the text.*
8.  Select and delete the entire interior of a comment. *Expected: the corresponding comment thread disappears; the HTML comments disappear from the markdown output.*

------------------------------------------------------------------------

<!--#BrzI8U67[AV0WFG98:"jcheng" at 2020-05-01T22:32:15.761Z] Comment z-->This comment ends the document; the end is invisibly at the start of the next paragraph.

<!--/#BrzI8U67-->

