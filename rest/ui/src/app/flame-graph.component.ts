import {AfterViewInit, Component, ElementRef, HostListener, Input, NgZone, ViewChild} from '@angular/core';
import {BehaviorSubject} from "rxjs";
import {GraphNode} from "./state.service";
import {doTimed, Duration} from "./api-service.service";

@Component({
  selector: 'FlameGraph',
  templateUrl: 'flame-graph.component.html',
  styleUrls: ['flame-graph.component.scss'],
})
export class FlameGraphComponent implements AfterViewInit {
  private layouter!: Layouter;

  private readonly layoutState$ = new BehaviorSubject<LayoutState>({});

  @ViewChild('flameContainer')
  public flameContainer!: ElementRef;

  @ViewChild("tooltip")
  public tooltip!: ElementRef;

  @Input()
  public flameGraph!: GraphNode;

  constructor(
    private readonly ngZone: NgZone) {
  }

  public ngAfterViewInit(): void {
    this.layouter = new Layouter(this.flameGraph, this.flameContainer.nativeElement);

    // observe graph state changes
    this.layoutState$.subscribe(state => this.layouter.layout(state));

    const container = this.flameContainer.nativeElement as HTMLElement;
    container.addEventListener("click", event => this.handleClickEvent(event));

    this.ngZone.runOutsideAngular(() => {
      container.addEventListener("mousemove", event => this.handleMouseOverEvent(event));
    });
  }

  @HostListener('window:resize')
  public onWindowResize() {
    if (this.flameGraph != null && this.layouter != null)
      this.layouter.layout(this.layoutState);
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
    const tooltip = this.tooltip.nativeElement as HTMLElement;

    const node = this.nodeFromEvent(event);
    if (!node) {
      tooltip.style.display = "none";
      return;
    }

    const element = this.layouter.elementOf(node);
    const x = element.offsetLeft + event.offsetX + 8;
    const y = element.offsetTop + event.offsetY + 8;

    tooltip.style.display = "block";
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";

    const childTime = node.children.reduce((acc, child) => acc.plus(child.value), Duration.ZERO);
    const selfTime = node.value.minus(childTime);

    tooltip.innerText = `${node.title}\ntotal: ${node.value}, self: ${selfTime}`;
  }

  private nodeFromEvent(event: MouseEvent): GraphNode | null {
    const target = event.target && event.target as HTMLElement;
    if (!target || !/^node-/.test(target.id))
      return null;

    const nodeId = target.id.slice(5);
    if (!nodeId)
      return null;

    return this.flameGraph.byId(parseInt(nodeId));
  }
}

class Layouter {
  private readonly elementCache: { [nodeId: number]: HTMLElement } = {};
  private pendingAppends: HTMLElement[] = [];

  constructor(
    private readonly root: GraphNode,
    private readonly container: HTMLElement) {

    // ensure that css is available in the document
    injectFlameGraphCSS();
  }

  public layout(state: LayoutState): void {
    doTimed("FlameGraph.layout", () => {
      const internalState: InternalLayoutState = {
        ...state,
        containerWidth: this.container.offsetWidth,
      };

      // expand all parent nodes of an expanded node
      if (state.selected) {
        const path = this.root.pathTo(state.selected);
        if (path == null)
          throw new Error(`No path found to ${state.selected}`);

        internalState.expanded = path;
        internalState.expandedIds = path.map(node => node.id);
      }

      this.doLayout(internalState, this.root, {level: 0, nodeOffset: 0, nodeSize: 1});

      // append all missing elements to the container
      if (this.pendingAppends.length) {
        this.container.append(...this.pendingAppends);
        this.pendingAppends = [];
      }
    });
  }

  private doLayout(state: InternalLayoutState, node: GraphNode, layout: NodeLayout) {
    if (layout.level !== 0) {
      this.applyNodeLayout(state.containerWidth, node, layout);
    }

    const childLevel = layout.level + 1;

    // true if we need to handle span expansion on childLevel
    const childLevelExpanded = !!state.expanded && childLevel < state.expanded.length;

    // track x position of children
    let childOffset = layout.nodeOffset;

    for (const child of node.children) {
      let childSize;

      if (layout.nodeSize === 0) {
        // fast pass, if parent is collapsed we can directly collapse this element too.
        childSize = 0;

      } else {
        if (childLevelExpanded) {
          if (state.expanded![childLevel] === child) {
            // fully expanded child
            childSize = layout.nodeSize;
          } else {
            // this child should not be displayed,
            // so we give it a width of zero.
            childSize = 0;
          }
        } else {
          childSize = child.value.millis / node.value.millis * layout.nodeSize;
        }

        if (state.containerWidth * childSize < 1) {
          // console.log(state.containerWidth, childSize)
          childSize = 0;
        }
      }

      this.doLayout(state, child, {
        nodeSize: childSize,
        nodeOffset: childOffset,
        level: layout.level + 1,
      });

      childOffset += childSize;
    }
  }

  public elementOf(node: GraphNode): HTMLElement {
    const cached = this.elementCache[node.id];
    if (cached != null)
      return cached;

    const elNode = document.createElement("div");
    elNode.id = "node-" + node.id;
    elNode.className = "span";
    elNode.style.backgroundColor = node.color;

    this.elementCache[node.id] = elNode;
    this.pendingAppends.push(elNode);

    return elNode;
  }

  private applyNodeLayout(containerWidth: number, node: GraphNode, layout: NodeLayout) {
    const tNode = this.elementOf(node);
    const tStyle = tNode.style;

    if (layout.nodeSize === 0) {
      tStyle.width = "0";
      tStyle.opacity = "0";
    } else {
      tStyle.width = percentOf(layout.nodeSize);
      tStyle.opacity = "1";
    }

    tStyle.top = (layout.level - 1) + "rem";
    tStyle.left = percentOf(layout.nodeOffset);

    if (containerWidth * layout.nodeSize > 35) {
      tNode.innerText = node.title;
    } else {
      tNode.innerText = "";
    }
  }
}

interface NodeLayout {
  nodeSize: number;
  nodeOffset: number;
  level: number;
}

interface LayoutState {
  selected?: GraphNode;
}

interface InternalLayoutState extends LayoutState {
  expanded?: GraphNode[];
  expandedIds?: number[];

  containerWidth: number;
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
      
      transition: left 250ms ease-out, width 250ms ease-out, opacity 250ms ease-out;
      
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

function percentOf(value: number): string {
  return (100 * value) + "%";
}
