import {Directive, Input, TemplateRef, ViewContainerRef} from '@angular/core';

@Directive({selector: '[recreate]'})
export class RecreateDirective {
  private previousValue: any = null;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef) {
  }

  @Input()
  public set recreate(value: any) {
    if (value == null && this.previousValue != null) {
      this.previousValue = null;
      this.viewContainer.clear();

    } else if (this.previousValue != value) {
      this.previousValue = value;

      this.viewContainer.clear();
      this.viewContainer.createEmbeddedView(this.templateRef, {
        recreate: value,
      });
    }
  }
}
