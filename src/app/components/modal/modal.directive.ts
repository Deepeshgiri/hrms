import { Directive, ElementRef, Input, OnChanges, Renderer2 } from '@angular/core';

export interface ModalOptions {
  width?: string;
  height?: string;
}

@Directive({
  standalone: false,
  selector: '[modal]',
})
export class ModalDirective implements OnChanges {
  @Input() show = false;
  @Input() options: ModalOptions = {};

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnChanges(): void {
    if (this.show) {
      this.renderer.setStyle(this.el.nativeElement, 'display', 'block');
      if (this.options?.width) {
        this.renderer.setStyle(this.el.nativeElement, 'width', this.options.width);
      }
      if (this.options?.height) {
        this.renderer.setStyle(this.el.nativeElement, 'height', this.options.height);
      }
    } else {
      this.renderer.setStyle(this.el.nativeElement, 'display', 'none');
    }
  }
}
