import validateOption   from "validate-option";
import AbstractRenderer from "../AbstractRenderer";

//import DisplayBase from "../DisplayBase";
import Base        from "../Base";
//import BaseEvent   from "../BaseEvent";
import DisplayTree      from "../DisplayTree";
import DisplayTreeEvent from "../DisplayTreeEvent";
import Node        from "../DisplayNode";

import cssComputeLayout from "css-layout";

import {
    rect,
    roundedRect1,
    roundedRect4,
    line,
    lineH,
    lineV,
    fillTextMultiline
} from "./DrawUtils";
import {
    measureText,
    nearestCaretPos,
    measureTextAtCaretPos,
    measureTextAtRange
} from "./TextMetrics";
import TextMetricsShared from '../TextMetrics';
import RendererEvent from "../RendererEvent";
import MouseEvent from "../../input/MouseEvent";
import NodeType from "../NodeType";

const DefaultOptions = {
    debugDrawLayout : false,
    debugDrawBounds : false,
    debugDrawHover  : false
};

const MOUSE_DOWN_THRESHOLD = 500;

export default class CanvasRenderer extends AbstractRenderer {

    constructor(canvas,options = {}){
        options = validateOption(options,DefaultOptions);
        super();

        this._canvas = canvas;
        this._ctx    = canvas.getContext('2d');

        this._displayTree = new DisplayTree();

        let base  = this._displayTree.base;
        Base.set(base);
        base.size = [canvas.width, canvas.height];

        //this._base = new DisplayBase();
        //this._base.size = [canvas.width, canvas.height];
        //Base.set(this._base);

        this._debugDrawLayout = options.debugDrawLayout;
        this._debugDrawBounds = options.debugDrawBounds;
        this._debugDrawHover  = options.debugDrawHover;

        // INPUT HANDLE
        let self = this;
        let mtimestamp = new Date().getTime();

        this._canvas.addEventListener('mousedown',function rendererMouseDown(e){
            e = {
                x : e.pageX,
                y : e.pageY,
                button : e.button,
                altKey : e.altKey,
                ctrlKey : e.ctrlKey,
                shiftKey : e.shiftKey
            };
            base.handleMouseDown(e);

            //for consistency across renderers
            let timestamp = new Date().getTime();
            if((timestamp - mtimestamp) <= MOUSE_DOWN_THRESHOLD){
                base.handleDblClick(e);
            }
            mtimestamp = timestamp;
        });

        this._canvas.addEventListener('mouseup',function rendererMouseUp(e){
            base.handleMouseUp({
                x : e.pageX,
                y : e.pageY,
                button : e.button,
                altKey : e.altKey,
                ctrlKey : e.ctrlKey,
                shiftKey : e.shiftKey
            });
        });

        this._canvas.addEventListener('mousemove',function rendererMouseMove(e){
            base.handleMouseMove({
                x : e.pageX,
                y : e.pageY,
                button : e.button,
                altKey : e.altKey,
                ctrlKey : e.ctrlKey,
                shiftKey : e.shiftKey
            });
        });

        function keyInfo(e){
            return {
                charCode : e.charCode,
                keyCode : e.keyCode,
                altKey : e.altKey,
                ctrlKey : e.ctrlKey,
                shiftKey : e.shiftKey,
                metaKey : e.metaKey
            };
        }

        this._canvas.addEventListener('keydown',function rendererKeyDown(e){
            e.preventDefault();
            base.handleKeyDown(keyInfo(e));
        });

        this._canvas.addEventListener('keyup',function rendererKeyUp(e){
            e.preventDefault();
            base.handleKeyUp(keyInfo(e));
        });

        //FIXME: doesnt get events although focus + tabindex
        this._canvas.addEventListener('keypress',function rendererKeyPress(e){
            e.preventDefault();
            base.handleKeyPress(keyInfo(e));
        });

        TextMetricsShared._measureText = function measureTextShared(str,options){
            return measureText(self._ctx,str,options);
        };
        TextMetricsShared._nearestCaretPos = function nearestCaretPosShared(x,str,options){
            return nearestCaretPos(self._ctx,x,str,options);
        };
        TextMetricsShared._measureTextAtCaretPos = function measureTextAtCaretPos(pos,str,options){
            return measureTextAtCaretPos(self._ctx,pos,str,options);
        };

        //this._base.addEventListener(BaseEvent.UPDATE_LAYOUT,function(){
        //    console.log('event','update layout');
        //    //self.computeLayout();
        //    //self.draw();
        //});

        this._displayTree.addEventListener(DisplayTreeEvent.UPDATE_LAYOUT,function(){

            self.draw();
        });
        this._displayTree.addEventListener(DisplayTreeEvent.UPDATE_DRAW,function(){

        });

    }

    /*----------------------------------------------------------------------------------------------------------------*/
    // COMPUTE LAYOUT
    /*----------------------------------------------------------------------------------------------------------------*/
    //
    //computeLayout(){
    //    let ctx = this._ctx;
    //
    //    function measure(maxWidth = 0, maxHeight = 0){
    //        let layout = this._layoutNode.layout;
    //        let style = this._layoutNode.style;
    //
    //        let borderWidth = style.borderWidth || 0;
    //        let fontSize = style.fontSize || 0;
    //        let paddingTop = style.paddingTop || 0;
    //        let paddingRight = style.paddingRight || 0;
    //        let paddingLeft = style.paddingLeft || 0;
    //        let paddingBottom = style.paddingBottom || 0;
    //
    //        if(style.padding){
    //            paddingTop = paddingRight = paddingBottom = paddingLeft = style.padding;
    //        }
    //
    //        ctx.font = `${fontSize}px ${style.fontFamily || 'Arial'}`;
    //
    //        let width = 0;
    //        let height = 0;
    //
    //        switch(style.whiteSpace){
    //            case 'nowrap':
    //                width = ctx.measureText(this._textContent).width;
    //                height = fontSize;
    //                break;
    //
    //            case 'normal':
    //            default:
    //                let size = measureText(
    //                    ctx, this._textContent,{
    //                        fontFamily : style.fontFamily,
    //                        fontSize : fontSize,
    //                        lineHeight : style.lineHeight,
    //                        maxWidth : Math.max(layout.width, maxWidth) - (paddingRight + paddingLeft + borderWidth * 2)
    //                    }
    //                );
    //                width = size.width;
    //                height = size.height;
    //                break;
    //        }
    //
    //        return {
    //            width : Math.max(width, maxWidth),
    //            height : Math.max(height, maxHeight)
    //        };
    //    }
    //
    //    function inject(node){
    //        let style = node.layoutNode.style;
    //
    //        if(node.textContent && node.textContent.length !== 0){
    //            style.measure = style.measure || measure.bind(node);
    //        }else if(style.measure){
    //            delete style.measure;
    //        }
    //
    //        for(let child of node.children){
    //            inject(child);
    //        }
    //    }
    //
    //    inject(this._base);
    //    cssComputeLayout(this._base.layoutNode);
    //}

    /*----------------------------------------------------------------------------------------------------------------*/
    // DEBUG DRAW
    /*----------------------------------------------------------------------------------------------------------------*/

    _debugDrawNodeLayout(node){
        let ctx = this._ctx;

        let layoutNode = node.layoutNode;
        let layout = layoutNode.layout;
        let style  = layoutNode.style;

        if(style.display === 'none' || style.visibility === 'hidden'){
            return;
        }

        function drawMargin(t, r = t, b = t, l = t){
            if(t === 0 || r === 0 || b === 0 || l === 0){
                return;
            }
            let centerV = layout.height * 0.5;
            let centerH = layout.width * 0.5;

            let handle = Math.min(Math.min(layout.width, layout.height), 20);
            let handleVA = centerV - handle * 0.5;
            let handleVB = centerV + handle * 0.5;
            let handleHA = centerH - handle * 0.5;
            let handleHB = centerH + handle * 0.5;

            ctx.setLineDash([2, 2]);
            ctx.beginPath();
                lineV(ctx, -l, handleVA, handleVB);
                lineV(ctx, 0, handleVA, handleVB);
                lineH(ctx, -l, 0, centerV);
                lineV(ctx, layout.width + r, handleVA, handleVB);
                lineV(ctx, layout.width, handleVA, handleVB);
                lineH(ctx, layout.width, layout.width + r, centerV);
                lineH(ctx, handleHA, handleHB, -t);
                lineH(ctx, handleHA, handleHB, 0);
                lineV(ctx, centerH, -t, 0);
                lineH(ctx, handleHA, handleHB, layout.height);
                lineH(ctx, handleHA, handleHB, layout.height + b);
                lineV(ctx, centerH, layout.height, layout.height + b);
            ctx.stroke();

            ctx.strokeStyle = 'rgb(200,200,200)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
                rect(ctx, -l, -t, layout.width + r + l, layout.height + b + t);
            ctx.stroke();
        }

        function drawSize(inset){
            ctx.beginPath();
            if(style.borderRadius){
                roundedRect1(ctx, 0, 0, layout.width, layout.height, style.borderRadius, inset);
            }else{
                let tl = style.borderRadiusTopLeft || 0;
                let tr = style.borderRadiusTopRight || 0;
                let br = style.borderRadiusBottomRight || 0;
                let bl = style.borderRadiusBottomLeft || 0;

                if(tl === 0 && tr === 0 && br === 0 && bl === 0){
                    rect(ctx, 0, 0, layout.width, layout.height, inset);
                }else{
                    roundedRect4(ctx, 0, 0, layout.width, layout.height, tl, tr, br, bl, inset);
                }
            }
            ctx.stroke();
        }

        ctx.save();
        ctx.translate(layout.left, layout.top);

            ctx.fillStyle = '#ffffff';
            drawSize();
            ctx.fill();

            let borderWidth = style.borderWidth || 0;
            ctx.setLineDash([5, 5]);

            //padding all
            ctx.strokeStyle = 'rgb(200,200,200)';
            if(style.padding){
                let padding = style.padding + borderWidth;
                ctx.beginPath();
                    lineH(ctx, 0, layout.width, padding);
                    lineH(ctx, 0, layout.width, layout.height - padding);
                    lineV(ctx, padding, 0, layout.height);
                    lineV(ctx, layout.width - padding, 0, layout.height);
                ctx.stroke();
            //padding individual
            }else{
                ctx.beginPath();
                if(style.paddingTop){
                    lineH(ctx, 0, layout.width, style.paddingTop + borderWidth);
                }
                if(style.paddingRight){
                    lineV(ctx, layout.width - borderWidth - style.paddingRight, 0, layout.height);
                }
                if(style.paddingBottom){
                    lineH(ctx, 0, layout.width, layout.height - style.paddingBottom - borderWidth);
                }
                if(style.paddingLeft){
                    lineV(ctx, style.paddingLeft + borderWidth, 0, layout.height);
                }
                ctx.stroke();
            }

            //margin all
            ctx.strokeStyle = '#ff00ff';
            if(style.margin){
                drawMargin(style.margin);
            //margin individual
            }else{
                drawMargin(style.marginTop || 0, style.marginRight || 0, style.marginBottom || 0, style.marginLeft || 0)
            }

            ctx.setLineDash([]);

            ctx.strokeStyle = '#ffff00';
            if(style.borderWidth){
                ctx.lineWidth = style.borderWidth;
                drawSize(style.borderWidth);
                ctx.lineWidth = 1;
            }

            //dimension
            ctx.strokeStyle = '#ff0000';
            drawSize();

            if(style.overflow === 'hidden'){
                ctx.clip();
            }

            //origin
            ctx.fillStyle = '#0000ff';
            ctx.fillRect(0, 0, 5, 5);

            //text-content
            if(node.textContent && node.textContent.length != 0){
                let fontSize      = style.fontSize || 0;
                let paddingTop    = style.paddingTop || 0;
                let paddingRight  = style.paddingRight || 0;
                let paddingLeft   = style.paddingLeft || 0;
                let paddingBottom = style.paddingBottom || 0;

                if(style.padding){
                    paddingTop = paddingRight = paddingBottom = paddingLeft = style.padding;
                }

                let x = borderWidth + paddingLeft;
                let y = borderWidth + paddingTop + fontSize - 2;

                ctx.font = `${fontSize}px ${style.fontFamily || 'Arial'}`;

                let textContent = node.textContent;

                switch(style.whiteSpace){
                    case 'nowrap':
                        ctx.fillText(textContent, x, y);
                        break;
                    case 'normal':
                    default:
                        let innerWidth  = layout.width - (paddingRight + paddingLeft + borderWidth * 2);
                        fillTextMultiline(
                            ctx, textContent,
                            x, y, {
                                fontSize: fontSize,
                                lineHeight: style.lineHeight,
                                textAlign : style.textAlign,
                                maxWidth: innerWidth
                            }
                        );
                        break;
                }

                if(node.type === NodeType.INPUT_TEXT){
                    if(node.showCaret){
                        let caretInput = node.caretInputPos;
                        let caretPos   = Math.max(node.caretPos,0);
                        let caretPosX  = measureTextAtCaretPos(ctx,caretPos,textContent) + paddingLeft;

                        ctx.save();
                            ctx.strokeStyle = '#999999';
                            ctx.beginPath();
                            lineV(ctx,caretInput.x, 0, layout.height);
                            lineH(ctx,0,layout.width,caretInput.y);
                            ctx.stroke();
                            ctx.strokeStyle = '#0000ff';
                            ctx.beginPath();
                            lineV(ctx,caretPosX,0,layout.height);
                            ctx.stroke();
                        ctx.restore();

                        if(node.isRangeSelected()){
                            let metrics = measureTextAtRange(ctx,node.selectionRange,node.textContent);

                            ctx.save();
                                ctx.fillStyle = 'rgba(15,15,15,0.125)';
                                ctx.fillRect(paddingLeft + metrics.offset,0,metrics.width,layout.height);
                            ctx.restore();
                        }
                    }
                }
            }

            for(let child of node.children){
                this._debugDrawNodeLayout(child);
            }
        ctx.restore();
    }

    _debugDrawNodeBounds(node){
        let ctx = this._ctx;
        let bounds = node.boundsGlobal;

        if(bounds){
            let x = bounds.x0;
            let y = bounds.y0;
            let w = bounds.x1 - x;
            let h = bounds.y1 - y;
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ff0000';
            ctx.strokeRect(x,y,w,h);
        }

        for(let child of node.children){
            this._debugDrawNodeBounds(child);
        }
    }

    _debugDrawNodeHovered(node){
        //let ctx = this._ctx;
        //let bounds = node.boundsGlobal;
        //
        //ctx.save();
        //ctx.lineWidth = 2;
        //ctx.strokeStyle = '#ff0000';
        //ctx.fillStyle = 'rgba(255,0,0,0.35)';
        //ctx.rect(
        //    bounds.x0,bounds.y0,
        //    bounds.x1 - bounds.x0,bounds.y1 - bounds.y0
        //);
        //ctx.fill();
        //ctx.stroke();
        //ctx.restore();
    }

    _drawNode(node){
        for(let child of node.children){
            this._drawNode(child);
        }
    }

    /*----------------------------------------------------------------------------------------------------------------*/
    // DRAW
    /*----------------------------------------------------------------------------------------------------------------*/

    draw(){
        let ctx  = this._ctx;
        let base = this._displayTree.base;

        if(this._debugDrawLayout || this._debugDrawBounds){
            ctx.clearRect(0, 0, base.width, base.height);
            ctx.save();
            if(this._debugDrawLayout){
                this._debugDrawNodeLayout(base);
            }
            ctx.restore();
            ctx.save();
            if(this._debugDrawBounds){
                this._debugDrawNodeBounds(base);
            }
            ctx.restore();
        } else {
            this._drawNode(this);
        }
        this.dispatchEvent(new RendererEvent(RendererEvent.DRAW));
    }
}
