import {AfterViewInit, Component, ElementRef, HostListener, Input, NgZone, ViewChild} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {ColorHex, FlameGraphNode} from './domain/graph-node';
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

  @ViewChild('flameContainer', { static: true })
  public readonly flameContainer!: ElementRef;

  @ViewChild('flameCanvas', { static: true })
  public readonly flameCanvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild("tooltip", { static: true })
  public readonly tooltip!: ElementRef;

  @Input()
  public readonly flameGraph!: FlameGraphNode;

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

    this.ngZone.runOutsideAngular(() => {
      container.addEventListener("mouseleave", event => this.handleMouseOverEvent(event));
    });
  }

  @HostListener('window:resize')
  public onWindowResize() {
    this.renderer.scheduleTick();
    this.renderer.applyCanvasSize();
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

    const node = this.nodeFromEvent(event);

    this.renderer.scheduleTick({hoverNode: node || undefined});

    if (!node) {
      elTooltip.style.display = "none";
      return;
    }

    const elCanvas = this.flameCanvas.nativeElement;

    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

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

  private nodeFromEvent(event: MouseEvent): FlameGraphNode | null {
    const target = event.target && event.target as HTMLElement;
    if (target !== this.flameCanvas.nativeElement)
      return null;

    const x = event.offsetX / target.offsetWidth;
    const y = (event.offsetY / 16) | 0;

    for (const layout of this.layouter.layouts.values()) {
      if (layout.level === y) {
        if (layout.nodeOffset <= x && x <= layout.nodeOffset + layout.nodeSize) {
          if (layout.nodeSize * target.offsetWidth >= 1) {
            return layout.node;
          }
        }
      }
    }

    return null;
  }
}

interface RenderParameters {
  hoverNode?: FlameGraphNode;
}

class Renderer {
  private params: RenderParameters = {};

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

  public applyCanvasSize() {
    let level = 0;
    for (const layout of this.layouts) {
      if (layout.level > level)
        level = layout.level;
    }

    const p = this.canvas.offsetParent! as HTMLElement;
    this.canvas.width = p.offsetWidth;
    this.canvas.height = 16 * level;

    this.scheduleTick();
  }

  public scheduleTick(params?: RenderParameters) {
    if (params) {
      if (deepEqual(this.params, params))
        return;

      this.params = params;
    }

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

        let width = (nodeSize * canvasWidth) | 0;
        if (width < 1)
          continue;

        // do the little split line
        if (width > 2)
          width--;

        const nodeOffset = t < 1 && layout.previousOffset != null
          ? ((1 - t) * layout.previousOffset + t * layout.nodeOffset)
          : layout.nodeOffset;

        const x = (nodeOffset * canvasWidth) | 0;

        const y = layout.level * 16;
        const height = 15;

        ctx.fillStyle = layout.node.color;

        if (layout.expanded) {
          ctx.fillStyle = colorWithAlpha(layout.node.color);
        }

        if (this.params.hoverNode === layout.node) {
          ctx.fillStyle = "lightblue";
        }

        ctx.fillRect(x, y, width, height);

        if (width > 64) {
          const rect = new Path2D();
          rect.rect(x, y, width, height);

          ctx.save();
          ctx.fillStyle = "black";
          ctx.clip(rect);
          ctx.fillText(layout.node.title, 2 + x | 0, y + 11);
          ctx.restore();
        }
      }
    });
  }
}

class Layouter {
  public layouts = new Map<FlameGraphNode, NodeLayout>();

  constructor(private readonly root: FlameGraphNode) {
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

interface NodeLayout {
  node: FlameGraphNode;
  nodeSize: number;
  nodeOffset: number;
  level: number;

  previousSize?: number;
  previousOffset?: number;

  expanded: boolean;
}

interface LayoutState {
  selected?: FlameGraphNode;
}

interface InternalLayoutState extends LayoutState {
  previous: ReadonlyMap<FlameGraphNode, NodeLayout>;
  expanded?: FlameGraphNode[];
  expandedIds?: number[];
}

function doLayout(state: InternalLayoutState, root: FlameGraphNode): Map<FlameGraphNode, NodeLayout> {
  const layouts: NodeLayout[] = [{node: root, level: 0, nodeOffset: 0, nodeSize: 1, expanded: !!state.expanded}];
  const previous = state.previous;

  for (let idx = 0; idx < layouts.length; idx++) {
    const layout = layouts[idx];

    const node = layout.node;

    const childLevel = layout.level + 1;

    // true if we need to handle span expansion on childLevel
    const childLevelExpanded = !!state.expanded && childLevel < state.expanded.length;
    let childIsExpanded: boolean = false;

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
          childIsExpanded = true;
        }
      } else {
        childSize = child.weight * childScale;
      }

      const childLayout: NodeLayout = {
        node: child,
        nodeSize: childSize,
        nodeOffset: childOffset,
        level: childLevel,
        expanded: childIsExpanded,
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

  const result = new Map<FlameGraphNode, NodeLayout>();
  layouts.forEach(layout => result.set(layout.node, layout));
  return result;
}

interface TooltipContent {
  node: FlameGraphNode;
}


function colorWithAlpha(color: ColorHex): ColorHex {
  return color.slice(0, 7) + "80";
}
