const { SchedulerInterrupt } = require('./constants/index');

// A class representation of a process queue that may hold either a 
// blocking or non-blocking process
class Queue {
  constructor(scheduler, quantum, priorityLevel, queueType) {
    this.processes = [];
    // The queue's priority level; the lower the number, the higher the priority
    this.priorityLevel = priorityLevel;
    // The queue's parent scheduler
    this.scheduler = scheduler;
    // The queue's allotted time slice; each process in this queue is executed for this amount of time in total
    // This may be done over multiple scheduler iterations
    this.quantum = quantum;
    // A counter to keep track of how much time the queue has been executing so far
    this.quantumClock = 0;
    this.queueType = queueType;
  }

  // Enqueues the given process. Return the enqueue'd process
  enqueue(process) {
    process.queue = this;
    this.processes.push(process);
  }

  // Dequeues the next process in the queue. Return the dequeue'd process
  dequeue() {
    return this.processes.shift();
  }

  // Return the least-recently added process without removing it from the list of processes
  peek() {
    return this.processes[0];
  }

  isEmpty() {
    if (this.processes.length === 0)
      return true;

    return false;
  }

  getPriorityLevel() {
    return this.priorityLevel;
  }

  getQueueType() {
    return this.queueType;
  }

  // Manages a process's execution for the given amount of time
  // Processes that have had their states changed should not be affected
  // Once a process has received the alloted time, it needs to be dequeue'd and 
  // then handled accordingly, depending on whether it has finished executing or not
  manageTimeSlice(currentProcess, time) {
    const { LOWER_PRIORITY } = SchedulerInterrupt;

    if (currentProcess.stateChanged || currentProcess.cpuTimeNeeded <= 0) {
      this.quantumClock = 0;
      this.dequeue();

      if (currentProcess.isFinished() === false)
        this.scheduler.handleInterrupt(this, currentProcess, LOWER_PRIORITY);
    }
    else {
      if (time > this.quantum) {
        this.quantumClock = 0;
        this.dequeue();
        this.emitInterrupt(currentProcess, LOWER_PRIORITY);
      }
      else {
        this.quantumClock = time;
      }
    }
  }

  // Execute the next non-blocking process (assuming this is a CPU queue)
  // This method should call `manageTimeSlice` as well as execute the next running process
  doCPUWork(time) {
    if (this.queueType === 'CPU_QUEUE') {
      if (this.processes.length > 0) {
        const currentProcess = this.peek();

        currentProcess.executeProcess(time);
        this.manageTimeSlice(currentProcess, time);
      }
    }
  }

  // Execute the next blocking process (assuming this is the blocking queue)
  // This method should call `manageTimeSlice` as well as execute the next blocking process
  doBlockingWork(time) {
    if (this.processes.length > 0) {
      const currentProcess = this.peek();

      currentProcess.executeBlockingProcess(time);
      this.manageTimeSlice(currentProcess, time);
    }
  }

  // The queue's interrupt handler for notifying when a process needs to be moved to a different queue
  // Should handle PROCESS_BLOCKED and PROCESS_READY interrupts
  // The process also needs to be removed from the queue
  emitInterrupt(source, interrupt) {
    const { PROCESS_BLOCKED } = SchedulerInterrupt;
    const { _pid } = source;

    if (interrupt === PROCESS_BLOCKED) {
      this.processes.splice(_pid, 1);
    }

    this.scheduler.handleInterrupt(this, source, interrupt);
  }
}

module.exports = Queue;
