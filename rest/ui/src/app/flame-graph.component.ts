import {AfterViewInit, Component, ElementRef, HostListener, Input, NgZone, ViewChild} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {GraphNode} from './domain/graph-node';
import {distinctUntilChanged} from "rxjs/operators";
import {deepEqual} from "./utils/deep-equal";
import {Logger} from "./utils/logger";

const logger = Logger.get("FlameGraphComponent");

@Component({
  selector: 'FlameGraph',
  templateUrl: 'flame-graph.component.html',
  styleUrls: ['flame-graph.component.scss'],
})
export class FlameGraphComponent implements AfterViewInit {
  private layouter!: Layouter;
  private renderer!: Renderer;

  private readonly layoutState$ = new BehaviorSubject<LayoutState>({});
  private readonly _tooltipContent$ = new BehaviorSubject<TooltipContent | null>(null);

  @ViewChild('flameContainer')
  public readonly flameContainer!: ElementRef;

  @ViewChild('flameCanvas')
  public readonly flameCanvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild("tooltip")
  public readonly tooltip!: ElementRef;

  @Input()
  public readonly flameGraph!: GraphNode;

  public readonly tooltipContent$ = this._tooltipContent$.pipe(distinctUntilChanged(deepEqual));

  constructor(
    private readonly ngZone: NgZone) {
  }

  public ngAfterViewInit(): void {
    this.layouter = new Layouter(this.flameGraph);
    this.renderer = new Renderer(this.ngZone, this.flameCanvas.nativeElement);

    const container = this.flameContainer.nativeElement as HTMLElement;

    // observe graph state changes
    this.layoutState$.subscribe(state => {
      this.layouter.update(state);
      this.renderer.update([...this.layouter.layouts.values()]);
    });

    container.addEventListener("click", event => this.handleClickEvent(event));

    this.ngZone.runOutsideAngular(() => {
      container.addEventListener("mousemove", event => this.handleMouseOverEvent(event));
    });
  }

  @HostListener('window:resize')
  public onWindowResize() {
    // if (this.flameGraph != null && this.layouter != null)
    //   this.layoutState$.next(this.layoutState);
  }

  private get layoutState(): LayoutState {
    return this.layoutState$.getValue();
  }

  private handleClickEvent(event: MouseEvent) {
    const node = this.nodeFromEvent(event);
    if (!node)
      return;

    this.layoutState$.next({
      ...this.layoutState,
      selected: node,
    });
  }

  private handleMouseOverEvent(event: MouseEvent) {
    const elTooltip = this.tooltip.nativeElement as HTMLElement;

    const mouseX = event.offsetX;
    const mouseY = event.offsetY;
    this.renderer.scheduleTick({mouseX: mouseX, mouseY: mouseY});

    const node = this.nodeFromEvent(event);
    if (!node) {
      elTooltip.style.display = "none";
      return;
    }

    const elCanvas = this.flameCanvas.nativeElement;

    if (mouseX <= elCanvas.offsetWidth / 2) {
      elTooltip.style.left = (mouseX + 8) + "px";
      elTooltip.style.right = null;
    } else {
      elTooltip.style.right = (elCanvas.offsetWidth - mouseX + 8) + "px";
      elTooltip.style.left = null;
    }

    elTooltip.style.display = "block";
    elTooltip.style.top = (mouseY + 8) + "px";

    this.ngZone.run(() => this._tooltipContent$.next({node}));
  }

  private nodeFromEvent(event: MouseEvent): GraphNode | null {
    const target = event.target && event.target as HTMLElement;
    if (target !== this.flameCanvas.nativeElement)
      return null;

    const x = event.offsetX / target.offsetWidth;
    const y = (event.offsetY / 16) | 0;

    for (const layout of this.layouter.layouts.values()) {
      if (layout.level === y) {
        if (layout.nodeOffset <= x && x <= layout.nodeOffset + layout.nodeSize) {
          return layout.node;
        }
      }
    }

    return null;
  }
}

interface RenderParameters {
  mouseX: number;
  mouseY: number;
}

class Renderer {
  private params: RenderParameters = {mouseX: -1, mouseY: -1};

  private layouts: NodeLayout[] = [];
  private timeOffset = Date.now();

  private hasScheduledTick: boolean = false;

  constructor(
    private readonly ngZone: NgZone,
    private readonly canvas: HTMLCanvasElement) {
  }

  update(layouts: NodeLayout[]) {
    this.layouts = layouts;
    this.timeOffset = Date.now();

    this.applyCanvasSize();
    this.scheduleTick();
  }

  private get timeValue(): number {
    const t = Math.min(1, 0.005 * (Date.now() - this.timeOffset));
    return Math.sin(0.5 * t * Math.PI);
  }

  private tick() {
    const timeValue = this.timeValue;
    if (timeValue < 1) {
      this.scheduleTick();
    }

    this.render(timeValue);
  }

  private applyCanvasSize() {
    let level = 0;
    for (const layout of this.layouts) {
      if (layout.level > level)
        level = layout.level;
    }

    const p = this.canvas.offsetParent! as HTMLElement;
    this.canvas.width = p.offsetWidth;
    this.canvas.height = 16 * level;

    return level;
  }

  public scheduleTick(params: RenderParameters = this.params) {
    this.params = params;

    if (!this.hasScheduledTick) {
      this.hasScheduledTick = true;

      this.ngZone.runOutsideAngular(() => {
        requestAnimationFrame(() => {
          this.hasScheduledTick = false;
          this.tick();
        })
      });
    }
  }

  public render(t: number) {
    logger.doTimed("FlameGraph.render", () => {
      const layouts = this.layouts;

      const ctx: CanvasRenderingContext2D = this.canvas.getContext("2d")!;

      // clear complete canvas
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const canvasWidth = this.canvas.width;

      for (const layout of layouts) {
        const nodeSize = t < 1 && layout.previousSize != null
          ? ((1 - t) * layout.previousSize + t * layout.nodeSize)
          : layout.nodeSize;

        const width = (nodeSize * canvasWidth) | 0;
        if (width < 1)
          continue;

        const nodeOffset = t < 1 && layout.previousOffset != null
          ? ((1 - t) * layout.previousOffset + t * layout.nodeOffset)
          : layout.nodeOffset;

        const x = (nodeOffset * canvasWidth) | 0;

        const y = layout.level * 16;
        const height = 16;

        ctx.fillStyle = layout.node.color;

        if (x < this.params.mouseX && this.params.mouseX < x + width) {
          if (y < this.params.mouseY && this.params.mouseY < y + 16) {
            ctx.fillStyle = "lightblue";
          }
        }

        ctx.fillRect(x, y, width, height);

        if (width > 64) {
          const rect = new Path2D();
          rect.rect(x, y, width, height);

          ctx.save();
          ctx.fillStyle = "black";
          ctx.clip(rect);
          ctx.fillText(layout.node.title, 2 + x | 0, y + 12);
          ctx.restore();
        }
      }
    });
  }
}

class Layouter {
  public layouts = new Map<GraphNode, NodeLayout>();

  constructor(private readonly root: GraphNode) {

    // ensure that css is available in the document
    injectFlameGraphCSS();
  }

  public update(state: LayoutState) {
    return logger.doTimed("FlameGraph.layout", () => {
      const internalState: InternalLayoutState = {
        ...state,
        previous: this.layouts,
      };

      // expand all parent nodes of an expanded node
      if (state.selected) {
        const path = this.root.pathTo(node => node === state.selected);
        if (path == null)
          throw new Error(`No path found to ${state.selected}`);

        internalState.expanded = path;
        internalState.expandedIds = path.map(node => node.id);
      }

      this.layouts = doLayout(internalState, this.root);
    });
  }
}

//
// public
//   elementOf(node
// :
//   GraphNode
// ):
//   HTMLElement
//   {
//     const cached = this.elementCache[node.id];
//     if (cached != null)
//       return cached;
//
//     const elNode = document.createElement("div");
//     elNode.id = "node-" + node.id;
//     elNode.className = "span";
//     elNode.style.backgroundColor = node.color;
//
//     this.elementCache[node.id] = elNode;
//     this.pendingAppends.push(elNode);
//
//     return elNode;
//   }
//
// private
//   applyNodeLayout(containerWidth
// :
//   number, node
// :
//   GraphNode, layout
// :
//   NodeLayout
// )
//   {
//     const tNode = this.elementOf(node);
//     const tStyle = tNode.style;
//
//     if (layout.nodeSize === 0) {
//       tStyle.width = "0";
//       tStyle.opacity = "0";
//       tStyle.visibility = "hidden";
//     } else {
//       tStyle.width = percentOf(layout.nodeSize);
//       tStyle.opacity = "1";
//       tStyle.visibility = null;
//     }
//
//     tStyle.top = layout.level + "rem";
//     tStyle.left = percentOf(layout.nodeOffset);
//
//     if (containerWidth * layout.nodeSize > 35) {
//       tNode.innerText = node.title;
//     } else {
//       tNode.innerText = "";
//     }
//   }
// }

interface NodeLayout {
  node: GraphNode;
  nodeSize: number;
  nodeOffset: number;
  level: number;

  previousSize?: number;
  previousOffset?: number;
}

interface LayoutState {
  selected?: GraphNode;
}

interface InternalLayoutState extends LayoutState {
  previous: ReadonlyMap<GraphNode, NodeLayout>;
  expanded?: GraphNode[];
  expandedIds?: number[];
}

function doLayout(state: InternalLayoutState, root: GraphNode): Map<GraphNode, NodeLayout> {
  const layouts: NodeLayout[] = [{node: root, level: 0, nodeOffset: 0, nodeSize: 1}];
  const previous = state.previous;

  for (let idx = 0; idx < layouts.length; idx++) {
    const layout = layouts[idx];

    const node = layout.node;

    const childLevel = layout.level + 1;

    // true if we need to handle span expansion on childLevel
    const childLevelExpanded = !!state.expanded && childLevel < state.expanded.length;

    // track x position of children
    let childOffset = layout.nodeOffset;

    // scale of children time to seconds
    const childScale = layout.nodeSize / node.weight;

    for (const child of node.children) {
      let childSize: number = 0;

      if (childLevelExpanded) {
        if (state.expanded![childLevel] === child) {
          // fully expanded child
          childSize = layout.nodeSize;
        }
      } else {
        childSize = child.weight * childScale;
      }

      const childLayout: NodeLayout = {
        node: child,
        nodeSize: childSize,
        nodeOffset: childOffset,
        level: childLevel,
      };

      // add animation function if changed
      const pl = previous.get(child);
      if (pl !== undefined) {
        childLayout.previousSize = pl.nodeSize;
        childLayout.previousOffset = pl.nodeOffset;
      }

      // record child layout to be drawn
      layouts.push(childLayout);

      childOffset += childSize;
    }
  }

  const result = new Map<GraphNode, NodeLayout>();
  layouts.forEach(layout => result.set(layout.node, layout));
  return result;
}

function injectFlameGraphCSS() {
  const css = `
    .span-container {
      position: relative;
    }
  
    .span-container > .span {
      display: block;
      position: absolute;
      
      height: 1rem;
      line-height: 1rem;
      
      box-sizing: border-box;
      background: #ccc;
      border-bottom: 1px solid white;
      border-right: 1px solid white;
      
      font-size: 0.66em;
      
      overflow: hidden;
      text-overflow: clip;
      
      white-space: nowrap;
      
      transition: left 250ms ease-out, width 250ms ease-out, opacity 250ms ease-out, visibility 250ms;
      
      cursor: pointer;
    }
  `;

  if (document.getElementById("flameGraphStyle") == null) {
    const style = document.createElement("style");
    style.textContent = css;
    style.id = "flameGraphStyle";
    document.head.appendChild(style);
  }
}

interface TooltipContent {
  node: GraphNode;
}

