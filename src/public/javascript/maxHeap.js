class MaxHeap {

    constructor(...elements) {
        if (elements.length > 0 && Array.isArray(elements[0])) {
            this.heap = elements[0];
            this.size = this.heap.length;
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
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[index] > this.heap[parentIndex]) { // child greater than parent
                // swap
                this.#swap(index, parentIndex);
                index = parentIndex;
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
        while (Math.floor((index - 1) / 2) <= lastIndex) { // while index has at least one child and 
            var childIndex = 2 * index + 1; // left child
            if (childIndex > lastIndex) return; // no children
            // check if right child exists and is greater than left child
            if (childIndex + 1 <= lastIndex && this.heap[childIndex + 1] > this.heap[childIndex]) {
                childIndex = childIndex + 1; // right child
            }
            if (childIndex !== index) {
                this.#swap(index, childIndex);
                index = childIndex;
            } else {
                return;
            }
        }
    }
    /**
     * Builds the max heap from the current array of elements by sifting down all non-leaf nodes.
     * Will only iterate through half of the array because at least half of the elements are leaf nodes.
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
    #expand() {
        this.capacity = Math.floor(this.capacity * 1.5);
    }
    deleteMax() {
        if (this.size === 0) return null;
        const maxValue = this.heap[0];
        this.#swap(0, this.endPtr);
        this.endPtr -= 1;
        this.size -= 1;
        this.#siftdown(0);
        return maxValue;
    }

    sort() {
        const sortedArray = [];
        const copyHeap = new MaxHeap(this.heap.slice(0, this.size));
        while (copyHeap.size > 0) {
            sortedArray.push(copyHeap.deleteMax());
        }
        return sortedArray;
    }
}