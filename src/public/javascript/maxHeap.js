/**
 * A MaxHeap implementation.
 * 
 * @class MaxHeap
 * @example
 * // Create an empty heap
 * const heap = new MaxHeap();
 * 
 * @example
 * // Create a heap from an existing array
 * const heap = new MaxHeap([5, 3, 8, 1, 2]);
 * 
 * @example
 * // Create a heap with a custom comparison function
 * const heap = new MaxHeap([{val: 5}, {val: 3}], (a, b) => a.val > b.val);
 * 
 * @property {Array} heap - The internal array storing heap elements
 * @property {number} size - The current number of elements in the heap
 * @property {number} capacity - The current capacity of the heap array
 * @property {number} endPtr - Pointer to the last element in the heap
 * @property {Function} comparisonFunc - Function used to compare elements (returns true if first arg should be higher in heap)
 */
export default class MaxHeap {

    constructor(...elements) {
        if (elements.length > 0 && Array.isArray(elements[0])) {
            this.heap = elements[0];
            this.size = this.heap.length;
            this.comparisonFunc = elements[1] || ((a, b) => a > b); // must be boolean function taking two args
            this.capacity = Math.max(10, this.size);
            this.endPtr = this.size - 1;
            this.heapify();
        } else {
            this.heap = [];
            this.size = 0;
            this.capacity = 10;
            this.endPtr = -1;
        }
    }


    /**
     * 
     * Swap two elements in the heap array.
     * Takes in two indecies and swaps the elements at those indecies.
     * @param {number} i - The index of the first element.
     * @param {number} j - The index of the second element.
     */
    #swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }
    /**
     * Sifts up an element at the given index by swapping it with its parent until the heap property is restored.
     * Good for when a new element is added to the end of the heap.
     * @param {number} index - The index of the element to sift up.
     */

    #siftup(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2); // look up parent index
            if (this.comparisonFunc(this.heap[index], this.heap[parentIndex])) { // if child greater than parent
                this.#swap(index, parentIndex); // swap their values
                index = parentIndex; // next index to check is the parent index
            } else {
                return;
            }
        }
    }
    /**
     * Sifts down an element at the given index by swapping it with its largest child until the heap property is restored.
     * Good for max removal from the top of the heap.
     * Also good for heapifying an array.
     * @param {number} index - The index of the element to sift down.
     */
    #siftdown(index) {
        const lastIndex = this.endPtr;
        while (((index * 2) + 1) <= lastIndex) { // while index has at least one child and is within bounds 
            var childIndex = 2 * index + 1; // look down to left child
            if (childIndex > lastIndex) return; // if there are no children, we are done
            if (childIndex + 1 <= lastIndex && this.comparisonFunc(this.heap[childIndex + 1], this.heap[childIndex])) { // check if right child exists and is greater than left child // right child greater than left child
                childIndex = childIndex + 1; // right child is larger and becomes the child to potentially swap with
            }
            if (this.comparisonFunc(this.heap[childIndex], this.heap[index])) { // child greater than parent
                this.#swap(index, childIndex); // swap their values
                index = childIndex; // next index to check is the child index
            } else {
                return;
            }
        }
    }
    #expand() {
        this.capacity = Math.floor(this.capacity * 1.5);
    }

    /**
     * Inserts a new value into the heap and maintains the heap property.
     * O(log n) time complexity.
     * @param {any} value 
     */
    insert(value) {
        if (this.size >= this.capacity) {
            this.#expand();
        }
        this.endPtr += 1;
        this.heap[this.endPtr] = value;
        this.size += 1;
        this.#siftup(this.endPtr);
    }

    /**
     *  Removes and returns the maximum value (root) from the heap and maintains the heap property.
     * O(log n) time complexity.
     * @returns {any} value
     */
    deleteMax() {
        if (this.size === 0) return null;
        const maxValue = this.heap[0];
        this.#swap(0, this.endPtr);
        this.endPtr -= 1;
        this.size -= 1;
        this.#siftdown(0);
        return maxValue;
    }

    /**
     * Transforms the current array into a valid max heap in-place.
     * O(n log n) time complexity.
     */
    heapify() {
        const startIdx = Math.floor((this.size - 2) / 2); // last non-leaf node
        for (let i = startIdx; i >= 0; i--) {
            this.#siftdown(i);
        }
    }

    /**
     * sorts the elements of the heap in descending order and returns a new array.
     * O(n log n) time complexity.
     * @returns {any[]}
     */

    sort() {
        const sortedArray = [];
        const copyHeap = new MaxHeap(this.heap.slice(0, this.size), this.comparisonFunc);
        while (copyHeap.size > 0) {
            sortedArray.push(copyHeap.deleteMax());
        }
        return sortedArray;
    }
}