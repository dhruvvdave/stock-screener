import '@testing-library/jest-dom';

// jsdom implements neither of these; the components call them for UX only.
Element.prototype.scrollIntoView = jest.fn();

if (!('Notification' in window)) {
  window.Notification = class {
    static permission = 'denied';
    static requestPermission = jest.fn().mockResolvedValue('denied');
  };
}
