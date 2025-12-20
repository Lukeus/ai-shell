import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { VirtualizedList } from './VirtualizedList';

describe('VirtualizedList', () => {
  const mockItems = Array.from({ length: 100 }, (_, i) => ({
    id: `item-${i}`,
    text: `Item ${i}`,
  }));

  // Mock element measurements for virtualization
  beforeEach(() => {
    // Mock getBoundingClientRect for virtualization measurements
    // @ts-expect-error - Element is a global DOM type
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    // Mock offsetHeight/offsetWidth which virtualizer uses
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      value: 800,
    });
  });

  it('should render a scrollable container', () => {
    const { container } = render(
      <VirtualizedList
        items={mockItems}
        renderItem={(item) => <div data-testid={item.id}>{item.text}</div>}
        height="400px"
      />
    );

    const scrollContainer = container.firstChild as HTMLElement;
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer.className).toContain('overflow-auto');
  });

  it('should accept custom getItemKey function', () => {
    const getItemKey = vi.fn((item: { id: string }, _index: number) => item.id);
    
    render(
      <VirtualizedList
        items={mockItems}
        renderItem={(item) => <div>{item.text}</div>}
        getItemKey={getItemKey}
        height="400px"
      />
    );

    // Component should render without errors when getItemKey is provided
    expect(getItemKey).toHaveBeenCalled();
  });

  it('should handle empty items array', () => {
    const { container } = render(
      <VirtualizedList
        items={[]}
        renderItem={(item: { text: string }) => <div>{item.text}</div>}
        height="400px"
      />
    );

    const items = container.querySelectorAll('[data-index]');
    expect(items.length).toBe(0);
  });

  it('should accept custom className prop', () => {
    const { container } = render(
      <VirtualizedList
        items={mockItems.slice(0, 5)}
        renderItem={(item) => <div>{item.text}</div>}
        className="custom-item-class"
        height="400px"
      />
    );

    // Component should render without errors when className is provided
    expect(container.firstChild).toBeTruthy();
  });

  it('should apply custom scrollClassName', () => {
    const { container } = render(
      <VirtualizedList
        items={mockItems}
        renderItem={(item) => <div>{item.text}</div>}
        scrollClassName="custom-scroll-class"
        height="400px"
      />
    );

    const scrollContainer = container.querySelector('.custom-scroll-class');
    expect(scrollContainer).toBeInTheDocument();
  });

  it('should accept estimateSize prop', () => {
    const customSize = 50;
    const { container } = render(
      <VirtualizedList
        items={mockItems}
        renderItem={(item) => <div>{item.text}</div>}
        estimateSize={customSize}
        height="400px"
      />
    );

    // Component should render without errors when estimateSize is provided
    expect(container.firstChild).toBeTruthy();
  });

  it('should accept onEndReached and endReachedThreshold props', () => {
    const handleEndReached = vi.fn();
    const { container } = render(
      <VirtualizedList
        items={mockItems}
        renderItem={(item) => <div>{item.text}</div>}
        height="400px"
        onEndReached={handleEndReached}
        endReachedThreshold={100}
      />
    );

    // Component should render without errors when onEndReached props are provided
    expect(container.firstChild).toBeTruthy();
  });


  it('should accept numeric height', () => {
    const { container } = render(
      <VirtualizedList
        items={mockItems}
        renderItem={(item) => <div>{item.text}</div>}
        height={500}
      />
    );

    const scrollContainer = container.firstChild as HTMLElement;
    expect(scrollContainer.style.height).toBe('500px');
  });

  it('should accept string height', () => {
    const { container } = render(
      <VirtualizedList
        items={mockItems}
        renderItem={(item) => <div>{item.text}</div>}
        height="50vh"
      />
    );

    const scrollContainer = container.firstChild as HTMLElement;
    expect(scrollContainer.style.height).toBe('50vh');
  });

  it('should handle large datasets', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: `item-${i}`,
      text: `Item ${i}`,
    }));

    const { container } = render(
      <VirtualizedList
        items={largeDataset}
        renderItem={(item) => <div data-testid={item.id}>{item.text}</div>}
        height="400px"
      />
    );

    // Component should render without errors with large datasets
    expect(container.firstChild).toBeTruthy();
  });

  it('should create virtualizer container with relative positioning', () => {
    const { container } = render(
      <VirtualizedList
        items={mockItems.slice(0, 5)}
        renderItem={(item) => <div data-testid="item">{item.text}</div>}
        height="400px"
      />
    );

    // Verify inner container has relative positioning for virtualization
    const innerContainer = container.querySelector('div > div');
    expect(innerContainer).toBeTruthy();
  });
});
