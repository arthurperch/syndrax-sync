/**
 * eBay Mesh Order Overlay - Styles
 * CSS styles as TypeScript constants for injection
 */

export const OVERLAY_STYLES = `
/* Main utility buttons container */
.ecomflow-utility-buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 12px;
    padding: 12px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 8px;
    border: 1px solid #dee2e6;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Automation row with Auto Order button */
.ecomflow-automation-div {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

/* Copy link button */
.ecomflow-copy-link-button {
    padding: 8px 16px;
    background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.ecomflow-copy-link-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    background: linear-gradient(135deg, #5a6268 0%, #3d4246 100%);
}

/* Auto order container */
.ecomflow-auto-order-container {
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
}

/* Main Auto Order button */
.ecomflow-auto-order-button {
    padding: 10px 20px;
    background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 3px 6px rgba(255,107,53,0.3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.ecomflow-auto-order-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255,107,53,0.4);
    background: linear-gradient(135deg, #ff5722 0%, #ff9800 100%);
}

.ecomflow-auto-order-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(255,107,53,0.3);
}

.ecomflow-auto-order-button.processing {
    background: linear-gradient(135deg, #adb5bd 0%, #6c757d 100%);
    cursor: wait;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

/* Settings icon */
.ecomflow-settings-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e9ecef;
    border: 1px solid #ced4da;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
}

.ecomflow-settings-icon:hover {
    background: #dee2e6;
    transform: rotate(45deg);
}

/* Settings modal */
.ecomflow-settings-modal {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    padding: 16px;
    min-width: 300px;
    z-index: 10000;
    display: none;
}

.ecomflow-settings-modal.visible {
    display: block;
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.ecomflow-settings-modal-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ecomflow-settings-modal-close {
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 18px;
    cursor: pointer;
    color: #6c757d;
    line-height: 1;
}

.ecomflow-settings-modal-close:hover {
    color: #343a40;
}

.ecomflow-settings-modal label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #495057;
    cursor: pointer;
}

.ecomflow-settings-modal input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #ff6b35;
}

.ecomflow-settings-modal textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 12px;
    resize: vertical;
    font-family: inherit;
}

.ecomflow-settings-modal input[type="text"] {
    width: 100%;
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
}

/* Quantity container */
.ecomflow-quantity-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    border-top: 1px solid #dee2e6;
    margin-top: 4px;
}

.ecomflow-quantity-label {
    font-size: 12px;
    color: #6c757d;
    font-weight: 500;
}

.ecomflow-quantity-select {
    padding: 6px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
    background: white;
    cursor: pointer;
}

.ecomflow-update-quantity-button {
    padding: 6px 12px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.ecomflow-update-quantity-button:hover {
    background: #218838;
}

/* ETA Section */
.ecomflow-eta-div {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid #dee2e6;
}

.ecomflow-eta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.ecomflow-eta-label {
    font-size: 12px;
    color: #6c757d;
    font-weight: 600;
    min-width: 30px;
}

.ecomflow-eta-field {
    padding: 6px 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 13px;
}

.ecomflow-eta-link {
    font-size: 11px;
    color: #007bff;
    text-decoration: none;
}

.ecomflow-eta-link:hover {
    text-decoration: underline;
}

.ecomflow-copy-eta-button {
    padding: 6px 12px;
    background: #17a2b8;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.ecomflow-copy-eta-button:hover {
    background: #138496;
}

/* Feedback Section */
.ecomflow-feedback-div {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid #dee2e6;
}

.ecomflow-feedback-link {
    font-size: 11px;
    color: #007bff;
    text-decoration: none;
}

.ecomflow-feedback-link:hover {
    text-decoration: underline;
}

.ecomflow-copy-feedback-button {
    padding: 6px 12px;
    background: #6f42c1;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
    align-self: flex-start;
}

.ecomflow-copy-feedback-button:hover {
    background: #5a32a3;
}

/* Action buttons container */
.ecomflow-action-buttons-container {
    padding-top: 10px;
    border-top: 1px solid #dee2e6;
}

.ecomflow-action-buttons-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.ecomflow-clipboard-label {
    font-size: 11px;
    color: #6c757d;
    font-weight: 500;
    margin-right: 4px;
}

.ecomflow-icon-button {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
}

.ecomflow-icon-button:hover {
    background: #f8f9fa;
    border-color: #adb5bd;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.ecomflow-icon-button img,
.ecomflow-icon-button svg {
    width: 20px;
    height: 20px;
}

.ecomflow-icon-button-status {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    font-size: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
}

.ecomflow-icon-button-status.success {
    background: #28a745;
}

.ecomflow-icon-button-status.error {
    background: #dc3545;
}

/* Toast notifications */
.ecomflow-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    background: #343a40;
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 100000;
    animation: slideInUp 0.3s ease;
}

.ecomflow-toast.success {
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
}

.ecomflow-toast.error {
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
}

.ecomflow-toast.info {
    background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
}

@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Section headers */
.ecomflow-section-header {
    font-size: 11px;
    font-weight: 600;
    color: #495057;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
}

/* Divider */
.ecomflow-divider {
    height: 1px;
    background: #dee2e6;
    margin: 8px 0;
}

/* Button states */
.ecomflow-button-copied {
    background: #28a745 !important;
}

/* Loading spinner */
.ecomflow-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
`;

export const INJECT_STYLES = (): void => {
    if (document.getElementById('ecomflow-overlay-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'ecomflow-overlay-styles';
    styleEl.textContent = OVERLAY_STYLES;
    document.head.appendChild(styleEl);
};
