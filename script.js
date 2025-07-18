/**
 * MTA Interactive Map Component
 * Highly optimized zoom and drag functionality
 */

class MTAMap {
    constructor() {
        this.mapContent = document.getElementById('mapContent');
        this.mapWrapper = this.mapContent.parentElement;
        this.zoomValue = document.getElementById('zoomValue');
        this.coordX = document.getElementById('coordX');
        this.coordY = document.getElementById('coordY');
        
        // Map state
        this.zoom = 1.0;
        this.minZoom = 0.3;
        this.maxZoom = 4.0;
        this.zoomStep = 0.1;
        this.smoothZoomStep = 0.02;
        
        // Position and dragging state
        this.x = 0;
        this.y = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.velocityX = 0;
        this.velocityY = 0;
        this.friction = 0.92;
        
        // Boundary constraints (1500px extra as requested)
        this.extraBoundary = 1500;
        this.mapSize = 2000;
        
        // Animation frame ID for optimization
        this.animationId = null;
        this.isAnimating = false;
        this.lastTransform = null;
        
        // Touch support
        this.lastTouchDistance = 0;
        this.touchStartTime = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.positionMarkers();
        this.startAnimationLoop();
    }
    
    setupEventListeners() {
        // Mouse events
        this.mapWrapper.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Wheel events for zoom
        this.mapWrapper.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Touch events
        this.mapWrapper.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.mapWrapper.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.mapWrapper.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Control buttons
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetView').addEventListener('click', () => this.resetView());
        
        // Prevent context menu on right click
        this.mapWrapper.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Prevent default drag behavior
        this.mapWrapper.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    handleMouseDown(e) {
        e.preventDefault();
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.velocityX = 0;
        this.velocityY = 0;
        this.mapWrapper.classList.add('dragging');
        this.mapContent.classList.remove('animating');
    }
    
    handleMouseMove(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        
        this.velocityX = deltaX * 0.1;
        this.velocityY = deltaY * 0.1;
        
        this.x += deltaX;
        this.y += deltaY;
        
        this.constrainPosition();
        this.updateTransform();
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    }
    
    handleMouseUp(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.mapWrapper.classList.remove('dragging');
        this.mapContent.classList.add('animating');
        
        // Apply momentum with smooth deceleration
        this.applyMomentum();
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.mapWrapper.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const delta = -e.deltaY * 0.001;
        this.smoothZoom(delta, mouseX, mouseY);
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
            this.touchStartTime = Date.now();
            this.mapWrapper.classList.add('dragging');
        } else if (e.touches.length === 2) {
            this.isDragging = false;
            this.mapWrapper.classList.remove('dragging');
            this.lastTouchDistance = this.getTouchDistance(e.touches);
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1 && this.isDragging) {
            const deltaX = e.touches[0].clientX - this.lastMouseX;
            const deltaY = e.touches[0].clientY - this.lastMouseY;
            
            this.velocityX = deltaX * 0.1;
            this.velocityY = deltaY * 0.1;
            
            this.x += deltaX;
            this.y += deltaY;
            
            this.constrainPosition();
            this.updateTransform();
            
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            const touchDistance = this.getTouchDistance(e.touches);
            const delta = (touchDistance - this.lastTouchDistance) * 0.01;
            
            const rect = this.mapWrapper.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            this.smoothZoom(delta, centerX, centerY);
            this.lastTouchDistance = touchDistance;
        }
    }
    
    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            this.isDragging = false;
            this.mapWrapper.classList.remove('dragging');
            this.mapContent.classList.add('animating');
            
            // Apply momentum for touch
            if (Date.now() - this.touchStartTime < 300) {
                this.applyMomentum();
            }
        }
    }
    
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    smoothZoom(delta, mouseX, mouseY) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
        
        if (this.zoom !== oldZoom) {
            // Calculate zoom point
            const zoomFactor = this.zoom / oldZoom;
            
            // Adjust position to zoom towards mouse position
            this.x = mouseX - (mouseX - this.x) * zoomFactor;
            this.y = mouseY - (mouseY - this.y) * zoomFactor;
            
            this.constrainPosition();
            this.updateTransform();
            this.updateDisplay();
        }
    }
    
    zoomIn() {
        const rect = this.mapWrapper.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        this.smoothZoom(this.zoomStep, centerX, centerY);
    }
    
    zoomOut() {
        const rect = this.mapWrapper.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        this.smoothZoom(-this.zoomStep, centerX, centerY);
    }
    
    resetView() {
        this.isAnimating = true;
        this.mapContent.classList.add('animating');
        
        // Animate to center position
        const targetX = (window.innerWidth - this.mapSize) / 2;
        const targetY = (window.innerHeight - this.mapSize) / 2;
        const targetZoom = 1.0;
        
        this.animateToPosition(targetX, targetY, targetZoom);
    }
    
    animateToPosition(targetX, targetY, targetZoom) {
        const startX = this.x;
        const startY = this.y;
        const startZoom = this.zoom;
        const duration = 800; // ms
        let startTime = null;
        
        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (cubic-bezier)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            this.x = startX + (targetX - startX) * easeProgress;
            this.y = startY + (targetY - startY) * easeProgress;
            this.zoom = startZoom + (targetZoom - startZoom) * easeProgress;
            
            this.constrainPosition();
            this.updateTransform();
            this.updateDisplay();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                this.mapContent.classList.remove('animating');
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    applyMomentum() {
        if (Math.abs(this.velocityX) < 0.1 && Math.abs(this.velocityY) < 0.1) return;
        
        const animate = () => {
            this.velocityX *= this.friction;
            this.velocityY *= this.friction;
            
            this.x += this.velocityX;
            this.y += this.velocityY;
            
            this.constrainPosition();
            this.updateTransform();
            
            if (Math.abs(this.velocityX) > 0.1 || Math.abs(this.velocityY) > 0.1) {
                requestAnimationFrame(animate);
            } else {
                this.mapContent.classList.remove('animating');
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    constrainPosition() {
        const rect = this.mapWrapper.getBoundingClientRect();
        const scaledMapSize = this.mapSize * this.zoom;
        
        // Calculate bounds with extra boundary
        const minX = rect.width - scaledMapSize - this.extraBoundary;
        const maxX = this.extraBoundary;
        const minY = rect.height - scaledMapSize - this.extraBoundary;
        const maxY = this.extraBoundary;
        
        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
    }
    
    updateTransform() {
        // Use transform3d for hardware acceleration and cache the transform string
        const transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.zoom})`;
        
        // Only update if the transform has changed
        if (this.lastTransform !== transform) {
            this.mapContent.style.transform = transform;
            this.lastTransform = transform;
        }
    }
    
    updateDisplay() {
        this.zoomValue.textContent = this.zoom.toFixed(1);
        this.coordX.textContent = Math.round(-this.x);
        this.coordY.textContent = Math.round(-this.y);
    }
    
    positionMarkers() {
        const markers = document.querySelectorAll('.location-marker');
        markers.forEach(marker => {
            const x = parseFloat(marker.dataset.x);
            const y = parseFloat(marker.dataset.y);
            
            // Convert percentage to pixel positions
            const pixelX = (x / 100) * this.mapSize;
            const pixelY = (y / 100) * this.mapSize;
            
            marker.style.left = `${pixelX}px`;
            marker.style.top = `${pixelY}px`;
        });
    }
    
    startAnimationLoop() {
        // Optimization: Only update when necessary
        let lastUpdateTime = 0;
        const throttleInterval = 16; // ~60fps
        
        const update = (currentTime) => {
            if (currentTime - lastUpdateTime >= throttleInterval) {
                if (this.isDragging || this.isAnimating) {
                    this.updateDisplay();
                }
                lastUpdateTime = currentTime;
            }
            this.animationId = requestAnimationFrame(update);
        };
        
        this.animationId = requestAnimationFrame(update);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Initialize the map when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const mtaMap = new MTAMap();
    
    // Expose for debugging
    window.mtaMap = mtaMap;
});